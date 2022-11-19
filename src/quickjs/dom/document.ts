import { QuickJSAsyncContext, Scope, VmFunctionImplementation } from 'quickjs-emscripten';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';
import { getDomNodeProxyDefinition } from './node';
import { createObjectFromDefinition } from '../proxy';
import { createSandboxStyleSheet } from './styles';
import { getNodeManager, NodeManager } from './nodeManager';
import { FilterFunctions } from './filters';
import { cloneAsHandle } from '../clone';

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

const createFakeWindow = (context: QuickJSAsyncContext, nodeManager: NodeManager) =>
  Scope.withScope((s) => {
    const hWindow = s.manage(context.newObject());
    context.setProp(hWindow, 'HTMLIFrameElement', s.manage(context.newFunction('HTMLIFrameElement', () => {})));
    context.setProp(hWindow, 'Node', nodeManager.nodePrototype.dup());

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

    context.setProp(
      hWindow,
      'getComputedStyle',
      s.manage(
        context.newFunction('getComputedStyle', (hNode) => {
          console.log('getComputedStyle');
          const tracked = nodeManager.findByHandle(hNode);
          if (!(tracked?.node instanceof HTMLElement)) {
            return context.null;
          }

          const computed = window.getComputedStyle(tracked.node);
          return cloneAsHandle(context, computed);
        })
      )
    );

    context.setProp(context.global, 'window', hWindow);
  });

const createReactRoot = (context: QuickJSAsyncContext, nodeManager: NodeManager, filters: FilterFunctions) => {
  const reactRootNode = document.createElement('div');
  return nodeManager.add({
    id: nodeManager.nextId(),
    node: reactRootNode,
    handle: createObjectFromDefinition({
      context: context,
      hObject: context.newObject(nodeManager.nodePrototype),
      definition: getDomNodeProxyDefinition({
        context: context,
        filters,
        nodeManager: nodeManager,
        node: reactRootNode
      })
    })
  });
};

const createFakeDocument = (
  context: QuickJSAsyncContext,
  nodeManager: NodeManager,
  filters: FilterFunctions,
  reactRoot: TrackedElement
) => {
  const fakeDocumentNode = document.createElement('section');
  return nodeManager.add({
    id: nodeManager.nextId(),
    node: fakeDocumentNode,
    handle: createObjectFromDefinition({
      context: context,
      hObject: context.newObject(nodeManager.nodePrototype),
      definition: {
        ...getDomNodeProxyDefinition({
          context: context,
          filters,
          nodeManager: nodeManager,
          node: fakeDocumentNode
        }),
        body: {
          get: () => reactRoot.handle.dup()
        },
        defaultView: {
          get: () => context.getProp(context.global, 'window')
        }
      }
    })
  });
};

export const createDomRootApi = (context: QuickJSAsyncContext, container: HTMLElement, filters: FilterFunctions) => {
  const createGlobalFn = getFunctionFactory(context, context.global);
  const nodeManager = getNodeManager(context);

  createFakeWindow(context, nodeManager);

  const disposers: VoidFunction[] = [];

  let shadow: ShadowRoot;

  createGlobalFn('createSandboxRootDomElement', () => {
    if (shadow) {
      return context.null;
    }

    const reactRoot = createReactRoot(context, nodeManager, filters);
    const fakeDocument = createFakeDocument(context, nodeManager, filters, reactRoot);

    context.setProp(reactRoot.handle, 'ownerDocument', fakeDocument.handle.dup());

    nodeManager.fakeDocument = fakeDocument;

    // Encapsulate react root into a shadow DOM
    shadow = (fakeDocument.node as HTMLElement).attachShadow({ mode: 'closed' });
    shadow.appendChild(document.createElement('style'));
    shadow.appendChild(reactRoot.node);
    container.appendChild(fakeDocument.node);

    createGlobalFn('createSandboxStyleSheet', () => createSandboxStyleSheet(context, shadow.styleSheets[0]));

    disposers.push(() => {
      fakeDocument.node.remove();
      nodeManager.dispose();
    });
    return reactRoot.handle.dup();
  });

  return {
    getShadowRoot: () => shadow,
    dispose: () => {
      disposers.map((dispose) => dispose());
    }
  };
};
