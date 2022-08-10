import { QuickJSAsyncContext } from 'quickjs-emscripten';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';
import { violation } from './log';

export const cloneAsHandle = (
  context: QuickJSAsyncContext,
  value: string | number | boolean | Object | Function,
  maxDepth = 1
) => {
  if (maxDepth <= 0) {
    return context.undefined;
  }

  switch (typeof value) {
    case 'string':
      return context.newString(value);
    case 'number':
      return context.newNumber(value);
    case 'boolean':
      return value ? context.true : context.false;
    case 'object': {
      if (value === null) {
        return context.null;
      }

      if (Object.getPrototypeOf(value) !== Object.prototype) {
        console.warn('Conversion of non-plain object unsupported', Object.getPrototypeOf(value));
        return context.undefined;
      }

      const handle = context.newObject();

      Object.entries(value).map(([key, val]) =>
        cloneAsHandle(context, val, maxDepth--).consume((handle) => context.setProp(handle, key, handle))
      );

      return handle;
    }
    case 'function': {
      return context.newFunction(
        'proxyFn',
        (...args: QuickJSHandle[]): QuickJSHandle => cloneAsHandle(context, value(...args.map(context.dump)))
      );
    }
    default: {
      violation(`Unsupported conversion from native type "${typeof value}" to QuickJS handle`, value);
      return context.undefined;
    }
  }
};
