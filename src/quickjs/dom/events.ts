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
        cloneAsHandle(context, value).consume((h) => context.setProp(hEvent, prop, h));
        break;
      case 'object':
        if (value === null) {
          context.defineProp(hEvent, prop, { value: context.null });
        } else if (value instanceof HTMLElement) {
          const found = findByNode(value);
          context.defineProp(hEvent, prop, {
            value: found && found.handle.alive ? found.handle.dup() : context.undefined
          });
        } else {
          context.defineProp(hEvent, prop, { value: context.undefined });
        }
        break;
      case 'function':
        switch (prop) {
          case 'stopPropagation':
          case 'preventDefault':
          case 'getModifierState':
            context.defineProp(hEvent, prop, { value: context.newFunction('_', () => event[prop]()) });
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
