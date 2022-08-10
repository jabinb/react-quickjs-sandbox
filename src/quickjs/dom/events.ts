import { QuickJSAsyncContext } from 'quickjs-emscripten';
import { TrackedElement } from './document';
import { cloneAsHandle } from '../clone';

export const domEventToQjsEvent = (
  context: QuickJSAsyncContext,
  event: Record<string | symbol, any>,
  findByNode: (child: HTMLElement) => TrackedElement | undefined
) => {
  const hEvent = context.newObject();

  // Note: no recursion, doesn't seem necessary
  for (const prop in event) {
    const value = event[prop];
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        context.setProp(hEvent, prop, cloneAsHandle(context, value));
        break;
      case 'object':
        if (value === null) {
          context.setProp(hEvent, prop, context.null);
        } else if (value instanceof HTMLElement) {
          const found = findByNode(value);
          context.setProp(hEvent, prop, found ? found.handle.dup() : context.undefined);
        } else {
          context.setProp(hEvent, prop, context.undefined);
        }
        break;
      case 'function':
        switch (prop) {
          case 'stopPropagation':
          case 'preventDefault':
          case 'getModifierState':
            context.setProp(hEvent, prop, cloneAsHandle(context, value));
            break;
        }
        break;
      default: {
        context.setProp(hEvent, prop, context.undefined);
        break;
      }
    }
  }

  return hEvent;
};
