import { QuickJSAsyncContext, Scope, VmFunctionImplementation } from 'quickjs-emscripten';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';
import { getDomNodeProxyDefinition } from './node';
import { createObjectFromDefinition } from '../proxy';
import { createSandboxStyleSheet } from './styles';
import { getNodeManager } from './queries';
import { FilterFunctions } from './filters';

export interface TrackedElement {
  id: number;
  node: HTMLElement | Text;
  handle: QuickJSHandle;
}

export const getFunctionFactory =
  (context: QuickJSAsyncContext, parent = context.global) =>
  (name: string, func: VmFunctionImplementation<QuickJSHandle>) => {
    context.newFunction(name, func).consume((hFunc) => context.setProp(parent, name, hFunc));
  };

export const createFakeWindow = (context: QuickJSAsyncContext) =>
  Scope.withScope((s) => {
    const hWindow = s.manage(context.newObject());
    context.setProp(hWindow, 'HTMLIFrameElement', s.manage(context.newFunction('HTMLIFrameElement', () => {})));
    context.setProp(context.global, 'window', hWindow);

    context.setProp(
      context.global,
      'console',
      s.manage(
        createObjectFromDefinition({
          context: context,
          warnOnDispose: false,
          definition: {
            log: (...args) => console.log(...args.map(context.dump)),
            warn: (...args) => console.warn(...args.map(context.dump)),
            error: (...args) => console.error(...args.map(context.dump))
          }
        })
      )
    );
  });

export const createDomRootApi = (context: QuickJSAsyncContext, container: HTMLElement, filters: FilterFunctions) => {
  const createGlobalFn = getFunctionFactory(context, context.global);

  const disposers: VoidFunction[] = [];

  createGlobalFn('createSandboxRootDomElement', () => {
    const queries = getNodeManager(context);

    const reactRootNode = document.createElement('div');
    const reactRoot = queries.add({
      id: queries.nextId(),
      node: reactRootNode,
      handle: createObjectFromDefinition({
        context: context,
        definition: getDomNodeProxyDefinition({
          context: context,
          filters,
          queries: queries,
          node: reactRootNode
        })
      })
    });

    const fakeDocumentNode = document.createElement('section');
    const fakeDocument = queries.add({
      id: queries.nextId(),
      node: reactRootNode,
      handle: createObjectFromDefinition({
        context: context,
        definition: getDomNodeProxyDefinition({
          context: context,
          filters,
          queries: queries,
          node: reactRootNode
        })
      })
    });

    context.setProp(reactRoot.handle, 'ownerDocument', fakeDocument.handle.dup());

    // Encapsulate react root into a shadow DOM
    const shadow = fakeDocumentNode.attachShadow({ mode: 'closed' });

    createGlobalFn('createSandboxStyleSheet', () => createSandboxStyleSheet(context, shadow.styleSheets[0]));

    shadow.appendChild(document.createElement('style'));
    shadow.appendChild(reactRootNode);

    container.appendChild(fakeDocumentNode);
    disposers.push(() => {
      fakeDocumentNode.remove();
      queries.dispose();
    });
    return reactRoot.handle.dup();
  });

  return () => {
    disposers.map((dispose) => dispose());
  };
};
