import { newQuickJSAsyncWASMModule, QuickJSAsyncContext, QuickJSAsyncWASMModule } from 'quickjs-emscripten';
import { createDomRootApi } from './dom/document';
import { createTimers } from './dom/timers';
import { FilterFunctions, isAllowedUrl, isAttributeAllowed, isInputTypeAllowed, isTagAllowed } from './dom/filters';
import { createObjectFromDefinition, ObjectDefinition } from './proxy';
import 'urlpattern-polyfill';
import { violation } from './log';

const moduleCache: Map<string, string> = new Map();

export type FilterOptions = Partial<FilterFunctions>;
export interface Options {
  container: HTMLElement;
  source: string;
  filters?: FilterOptions;
  moduleLoader?: (moduleName: string) => Promise<string>;
  extraGlobalsDefinition?: (context: QuickJSAsyncContext) => ObjectDefinition;
}

export interface QjsReactSandbox {
  context: QuickJSAsyncContext;
  getShadowRoot: () => ShadowRoot | undefined;
  disposeContext: VoidFunction;
}

export const createQjsReactSandbox = async ({
  container,
  source,
  filters,
  moduleLoader,
  extraGlobalsDefinition
}: Options): Promise<QjsReactSandbox> => {
  const module: QuickJSAsyncWASMModule = await newQuickJSAsyncWASMModule();
  const runtime = module.newRuntime({ memoryLimitBytes: -1 });

  const context: QuickJSAsyncContext = runtime.newContext();

  const { getShadowRoot, dispose: disposeRootApi } = createDomRootApi(context, container, {
    isInputTypeAllowed: filters?.isInputTypeAllowed ?? isInputTypeAllowed,
    isTagAllowed: filters?.isTagAllowed ?? isTagAllowed,
    isAttributeAllowed: filters?.isAttributeAllowed ?? isAttributeAllowed,
    isAllowedUrl: filters?.isAllowedUrl ?? isAllowedUrl
  });
  const disposeTimers = createTimers(context);

  if (extraGlobalsDefinition) {
    createObjectFromDefinition({
      context,
      warnOnDispose: false,
      definition: extraGlobalsDefinition?.(context),
      hObject: context.global
    });
  }

  context.runtime.setModuleLoader(moduleLoader ?? defaultModuleLoader);
  context.unwrapResult(await context.evalCodeAsync(source)).dispose();

  return {
    context,
    getShadowRoot,
    disposeContext: () => {
      disposeRootApi();
      disposeTimers();
      context.dispose();
    }
  };
};

export const defaultModuleLoader = async (moduleName: string) => {
  const origin = 'https://esm.sh/';
  const u = new URL(moduleName, origin);

  if (!origin.includes(u.origin)) {
    violation(`Invalid import "${moduleName}"`);
    throw new Error(`Invalid import "${moduleName}"`);
  }

  const url = u.toString();

  if (!moduleCache.has(url)) {
    const bundled = await fetch(url).then((response) => response.text());
    moduleCache.set(url, bundled);
  }

  return Promise.resolve(moduleCache.get(url)!);
};
