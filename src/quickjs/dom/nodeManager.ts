import { QuickJSAsyncContext } from 'quickjs-emscripten';
import { TrackedElement } from './document';
import { QuickJSHandle } from 'quickjs-emscripten/dist/types';

export interface NodeManager {
  nextId: () => number;
  add: (el: TrackedElement) => TrackedElement;
  findByNode: (searchNode: HTMLElement) => TrackedElement | undefined;
  findByHandle: (handle: QuickJSHandle) => TrackedElement | undefined;
  deleteByHandle: (handle: QuickJSHandle) => TrackedElement;
  findById: (id: number) => TrackedElement | undefined;
  fakeDocument?: TrackedElement;
  nodePrototype: QuickJSHandle;
  dispose: VoidFunction;
}

export const getNodeManager = (context: QuickJSAsyncContext): NodeManager => {
  const tracked = new Map<number, TrackedElement>();

  const nextId = (() => {
    let id = 0;
    return () => ++id;
  })();

  const findByNode = (searchNode: HTMLElement): TrackedElement | undefined => {
    for (let [_, value] of tracked.entries()) {
      if (value.node === searchNode) {
        return value;
      }
    }

    return undefined;
  };

  const findByHandle = (handle: QuickJSHandle): TrackedElement | undefined => {
    const id = context.getNumber(context.getProp(handle, '_id'));
    if (!tracked.has(id)) {
      console.warn('Missing ', id, [...tracked.entries()]);
    }
    return tracked.get(id);
  };

  const deleteByHandle = (handle: QuickJSHandle): TrackedElement => {
    const child = findByHandle(handle);
    if (!child) {
      throw new Error('Missing tracked child');
    }

    tracked.delete(child.id);
    handle.dispose();

    return child;
  };

  const add = (el: TrackedElement) => {
    tracked.set(el.id, el);
    return el;
  };

  const findById = (id: number) => {
    return tracked.get(id);
  };

  const nodePrototype = context.unwrapResult(
    context.evalCode(
      `
        (() => class {
          static [Symbol.hasInstance](instance) {
            return true;
          }
        })()
      `
    )
  );

  return {
    nextId,
    add,
    findByNode,
    findByHandle,
    deleteByHandle,
    findById,
    nodePrototype,
    dispose: () => {
      [...tracked.values()].map((value) => value.handle.dispose());
    }
  };
};
