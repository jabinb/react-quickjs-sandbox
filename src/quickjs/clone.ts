import { QuickJSAsyncContext } from 'quickjs-emscripten';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';
import { violation } from './log';

type CloneAsHandle = (
  context: QuickJSAsyncContext,
  value: string | number | boolean | Object | Function | Array<any>,
  maxDepth?: number
) => QuickJSHandle;

export const cloneAsHandleF = (context: QuickJSAsyncContext) => cloneAsHandle.bind(null, context);

export const cloneAsHandle: CloneAsHandle = (context, value, maxDepth = 10) => {
  maxDepth--;
  if (maxDepth < 0) {
    return context.undefined;
  }

  if (value === null) {
    return context.null;
  }

  switch (typeof value) {
    case 'string':
      return context.newString(value);
    case 'number':
      return context.newNumber(value);
    case 'boolean':
      return value ? context.true : context.false;
    case 'object': {
      if (Array.isArray(value)) {
        const hArray = context.newArray();

        for (let i = 0; i < value.length; i++) {
          cloneAsHandle(context, value[i], maxDepth).consume((hn) => context.setProp(hObject, i, hn));
        }
        return hArray;
      } else if (Object.getPrototypeOf(value) !== Object.prototype) {
        violation('Conversion of non-plain object unsupported', Object.getPrototypeOf(value));
        return context.undefined;
      }

      const hObject = context.newObject();

      Object.entries(value).map(([key, val]) =>
        cloneAsHandle(context, val, maxDepth).consume((hn) => context.setProp(hObject, key, hn))
      );

      return hObject;
    }
    case 'function': {
      return context.newFunction('proxyFn', (...args: QuickJSHandle[]): QuickJSHandle => {
        const result = value(...args.map(context.dump));
        return cloneAsHandle(context, result);
      });
    }
    case 'undefined': {
      return context.undefined;
    }
    default: {
      violation(`Unsupported conversion from native type "${typeof value}" to QuickJS handle`, value);
      return context.undefined;
    }
  }
};
