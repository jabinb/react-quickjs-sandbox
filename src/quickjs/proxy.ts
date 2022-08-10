import { QuickJSAsyncContext, Scope, VmFunctionImplementation, VmPropertyDescriptor } from 'quickjs-emscripten';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';
import { Lifetime } from 'quickjs-emscripten/dist/lifetime';
import { cloneAsHandle } from './clone';

export type GetHandler<T extends Object> = (
  target: T,
  prop: keyof T,
  hTarget: QuickJSHandle,
  hReceiver: QuickJSHandle
) => string | number | boolean | object | Function;
export type SetHandler<T extends Object> = (
  target: T,
  prop: keyof T,
  value: any,
  hTarget: QuickJSHandle,
  hValue: QuickJSHandle,
  hReceiver: QuickJSHandle
) => boolean;

export type GuardGetOperation<T extends Object> = { type: 'get'; prop: keyof T };
export type GuardSetOperation<T extends Object> = { type: 'set'; prop: keyof T; value: any };
export type GuardHandler<T extends Object> = (op: GuardSetOperation<T> | GuardGetOperation<T>) => boolean;

export interface ObjectDefinition {
  [K: string]:
    | string
    | boolean
    | number
    | VmFunctionImplementation<QuickJSHandle>
    | VmPropertyDescriptor<QuickJSHandle>
    | QuickJSHandle;
}

export const createObjectProxy = <T extends Object>({
  context,
  target,
  handler
}: {
  context: QuickJSAsyncContext;
  target: T;
  handler: { get: GetHandler<T>; set: SetHandler<T> } | { guard?: GuardHandler<T> };
}) => {
  const guard = 'guard' in handler && handler.guard ? handler.guard : () => true;

  const get = (hTarget: QuickJSHandle, hProp: QuickJSHandle, hReceiver: QuickJSHandle): QuickJSHandle => {
    const prop = context.getString(hProp) as keyof T;
    return cloneAsHandle(
      context,
      'get' in handler ? handler.get(target, prop, hTarget, hReceiver) : guard({ type: 'get', prop })
    );
  };

  const set = (hTarget: QuickJSHandle, hProp: QuickJSHandle, hValue: QuickJSHandle, hReceiver: QuickJSHandle) => {
    const prop = context.getString(hProp) as keyof T;
    const value = context.dump(hValue);

    if ('set' in handler) {
      return cloneAsHandle(context, handler.set(target, prop, value, hTarget, hValue, hReceiver));
    }

    if (!guard({ type: 'set', prop, value })) {
      return context.false;
    }

    target[prop] = context.dump(hValue);
    return context.true;
  };

  return Scope.withScope((s) => {
    const hHandler = s.manage(context.newObject());

    context.setProp(hHandler, 'get', s.manage(context.newFunction('get', get)));
    context.setProp(hHandler, 'set', s.manage(context.newFunction('set', set)));

    const hTarget = s.manage(context.newObject());
    const hFactory = s.manage(
      context.unwrapResult(context.evalCode('((target, handler) => new Proxy(target, handler));'))
    );

    return context.unwrapResult(context.callFunction(hFactory, context.undefined, hTarget, hHandler));
  });
};

export const createObjectFromDefinition = <T extends ObjectDefinition>({
  context,
  definition,
  hObject = context.newObject(),
  warnOnDispose = true
}: {
  context: QuickJSAsyncContext;
  definition: T;
  hObject?: QuickJSHandle;
  warnOnDispose?: boolean;
}) => {
  Scope.withScope((s) => {
    for (const [prop, value] of Object.entries(definition)) {
      switch (typeof value) {
        case 'boolean':
          context.defineProp(hObject, prop, { value: value ? context.true : context.false });
          break;
        case 'number':
          context.defineProp(hObject, prop, { value: s.manage(context.newNumber(value)) });
          break;
        case 'string':
          context.defineProp(hObject, prop, { value: s.manage(context.newString(value)) });
          break;
        case 'function':
          context.newFunction(prop, value).consume((hFunc) => context.setProp(hObject, prop, hFunc));
          break;
        case 'object':
          if (value === null) {
            context.defineProp(hObject, prop, { value: context.null });
            break;
          } else if (value instanceof Lifetime) {
            context.defineProp(hObject, prop, { value });
          } else if (Object.getPrototypeOf(value) === Object.prototype) {
            context.defineProp(hObject, prop, value);
          } else {
            context.defineProp(hObject, prop, { value: context.undefined });
          }
          break;
      }
    }
  });

  // if (warnOnDispose) {
  //   const existingDispose = hObject.dispose.bind(hObject);
  //   hObject.dispose = () => {
  //     console.warn("Help! I'm being disposed when I shouldn't be! (warnOnDispose: true)", {
  //       handle: hObject,
  //       definition
  //     });
  //     existingDispose();
  //   };
  // }

  return hObject;
};
