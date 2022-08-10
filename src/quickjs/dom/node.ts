import { QuickJSAsyncContext, Scope } from 'quickjs-emscripten';
import { createObjectFromDefinition, ObjectDefinition } from '../proxy';
import { JSValueConstPointer, JSValuePointer } from 'quickjs-emscripten/dist/types-ffi';
import { domEventToQjsEvent } from './events';
import { FilterFunctions, getAttributePropertyEquivalent } from './filters';
import { violation } from '../log';
import { NodeManager } from './queries';
import { createStyleDeclarationProxy } from './styles';

type ConstructorType<T = any> = { prototype: T; new (): T };

const instanceOfAny =
  <Args extends [...ConstructorType[]]>(...args: Args) =>
  (node: any): node is Args[number]['prototype'] => {
    return args.map((ctor) => node instanceof ctor).filter((v) => v).length > 0;
  };

export const getDomNodeProxyDefinition = ({
  context,
  queries,
  filters,
  node,
  id = queries.nextId(),
  eventListeners = new Map<JSValueConstPointer | JSValuePointer, VoidFunction>()
}: {
  context: QuickJSAsyncContext;
  queries: NodeManager;
  filters: FilterFunctions;
  node: HTMLElement | Text;
  id?: number;
  eventListeners?: Map<JSValueConstPointer | JSValuePointer, VoidFunction>;
}): ObjectDefinition => ({
  // common definitions for text nodes and dom nodes
  _id: {
    // readonly
    get: () => context.newNumber(id)
  },
  nodeType: node.nodeType,
  nodeName: node.nodeName,
  textContent: {
    get: () => context.newString(node.textContent || ''),
    set: (value) => {
      node.textContent = context.getString(value);
    }
  },
  nodeValue: {
    get: () => context.newString(node.nodeValue || ''),
    set: (value) => {
      node.nodeValue = context.dump(value);
    }
  },
  // general dom node specific definitions
  ...(node instanceof Text
    ? {}
    : {
        tagName: node.tagName,
        style: createStyleDeclarationProxy(context, node),
        createElement: (hType) => {
          let type = context.getString(hType) as keyof HTMLElementTagNameMap;

          if (!filters.isTagAllowed(type)) {
            violation(`createElement(<${type.toLowerCase()}>) is not allowed; it will be coerced to <div>`);
            type = 'div';
          }

          const newNode = document.createElement(type);
          const id = queries.nextId();

          const element = queries.add({
            id,
            node: newNode,
            handle: createObjectFromDefinition({
              context: context,
              definition: getDomNodeProxyDefinition({
                context: context,
                queries: queries,
                filters,
                node: newNode,
                id: id
              })
            })
          });
          return element.handle.dup();
        },
        createTextNode: (hText) => {
          const textNode = document.createTextNode(context.getString(hText));
          const id = queries.nextId();

          const element = queries.add({
            id,
            node: textNode,
            handle: createObjectFromDefinition({
              context: context,
              definition: getDomNodeProxyDefinition({
                context: context,
                queries: queries,
                filters,
                node: textNode,
                id: id
              })
            })
          });
          return element.handle.dup();
        },
        createElementNS: (hNamespace, hName) => {
          let namespace = context.getString(hNamespace);

          if (namespace !== 'http://www.w3.org/1999/xhtml' && namespace !== 'http://www.w3.org/2000/svg') {
            violation(`createElementNS(${namespace}) is not allowed and was ignored`);
            namespace = 'http://www.w3.org/1999/xhtml';
          }

          let name = context.getString(hName);

          if (!filters.isTagAllowed(name)) {
            violation(`createElementNS(<${name.toLowerCase()}>) is not allowed; it will be coerced to <div>`);
            name = 'div';
          }

          const textNode = document.createElementNS(namespace, name) as HTMLElement;
          const id = queries.nextId();

          const element = queries.add({
            id,
            node: textNode,
            handle: createObjectFromDefinition({
              context: context,
              definition: getDomNodeProxyDefinition({
                context: context,
                queries: queries,
                filters,
                node: textNode,
                id: id
              })
            })
          });
          return element.handle.dup();
        },
        getAttribute: (hAttr) => {
          const name = context.getString(hAttr);

          if (!filters.isAttributeAllowed(node, name)) {
            violation(
              `Access to <${node.nodeName.toLowerCase()}>.getAttribute('${name}') is not allowed; returning 'undefined' instead`
            );
            return context.undefined;
          }

          const value = node.getAttribute(name);
          return value ? context.newString(value) : context.null;
        },
        setAttribute: (hAttr, hValue) => {
          const name = context.getString(hAttr);
          let value = context.getString(hValue);

          if (!filters.isAttributeAllowed(node, name)) {
            violation(
              `Access to <${node.nodeName.toLowerCase()}>.setAttribute('${name}', ...) is not allowed and was not set`
            );
            return;
          }

          if (name === 'type' && node.tagName === 'INPUT' && !filters.isInputTypeAllowed(value)) {
            violation(`<input type="${value}"> is not allowed; it will be coerced to "text"`);
            value = 'text';
          }

          const prop = getAttributePropertyEquivalent(name);
          if (prop) {
            (node as any)[prop] = value;
          } else {
            node.setAttribute(name, value);
          }
        },
        removeAttribute: (hAttr) => {
          const name = context.getString(hAttr);

          if (!filters.isAttributeAllowed(node, name)) {
            violation(
              `Access to <${node.nodeName.toLowerCase()}>.removeAttribute('${name}') is not allowed and cannot be removed`
            );
            return;
          }

          node.removeAttribute(context.getString(hAttr));
        },
        appendChild: (hChild) => {
          const child = queries.findByHandle(hChild);

          if (!child) {
            // console.error(context.dump(hChild));
            throw new Error('Missing tracked child');
          }

          node.appendChild(child.node);
          return hChild;
        },
        removeChild: (hChild) => {
          const hChildRet = hChild.dup(); // Need to send back the child, the handle will be disposed by deleteByHandle
          node.removeChild(queries.deleteByHandle(hChild).node);
          return hChildRet;
        },
        addEventListener: (hEventName, hFunc, hOptions) => {
          const duped = hFunc.dup();
          const eventName = context.getString(hEventName);

          const listener: EventListener = (ev) => {
            try {
              context
                .unwrapResult(
                  context.callFunction(duped, context.undefined, domEventToQjsEvent(context, ev, queries.findByNode))
                )
                .dispose();
              context.runtime.executePendingJobs();
            } catch (e) {
              console.error('Error during event handler', e, ev);
            }
          };

          node.addEventListener(eventName, listener, context.dump(hOptions));

          eventListeners.set(duped.value, () => {
            node.removeEventListener(eventName, listener);
            duped.dispose();
          });
        },
        removeEventListener: (hEventName, hFunc) => {
          eventListeners.get(hFunc.value)?.();
        },

        // Extended definitions for specific tags, e.g. <select>, <input> etc
        ...extendDefinitionForTag(context, queries, node)
      })
});

export const extendDefinitionForTag = (
  context: QuickJSAsyncContext,
  queries: NodeManager,
  node: HTMLElement
): ObjectDefinition => {
  const definition: ObjectDefinition = {};

  if (instanceOfAny(HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, HTMLOptionElement)(node)) {
    definition.value = {
      get: () => context.newString(node.value || ''),
      set: (value) => {
        node.value = context.getString(value);
      }
    };
  }

  if (instanceOfAny(HTMLInputElement)(node)) {
    definition.checked = {
      get: () => (node.checked ? context.true : context.false),
      set: (value) => {
        node.checked = value === context.true;
      }
    };
  }

  if (instanceOfAny(HTMLSelectElement)(node)) {
    definition.options = {
      get: () => {
        const hCollection = context.newObject();

        Scope.withScope((s) => {
          for (let i = 0; i < node.options.length; i++) {
            const hOption = queries.findByNode(node.options[i])?.handle;

            if (!hOption) {
              throw new Error('Missing hOption');
            }
            context.setProp(hCollection, i, hOption.dup());
          }
          context.setProp(hCollection, 'length', s.manage(context.newNumber(node.options.length)));
          context.setProp(hCollection, 'selectedIndex', s.manage(context.newNumber(node.options.selectedIndex)));
        });

        return hCollection;
      }
    };
  }

  return definition;
};
