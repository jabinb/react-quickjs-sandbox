import { createObjectFromDefinition, createObjectProxy } from '../proxy';
import { QuickJSAsyncContext } from 'quickjs-emscripten';
import postcss, { Declaration } from 'postcss';
import { defaultAllowedUrlDataTypes, defaultAllowedUrlSchemes, isAllowedUrl } from './filters';
import { violation } from '../log';

const parseUrls = (cssValue: string): URL[] => {
  const URL_PATTERN = /(url\(\s*['"]?)([^"')]+)(["']?\s*\))/g;

  const matches = [...cssValue.matchAll(URL_PATTERN)];
  const urls: URL[] = [];

  if (matches.length < 1) {
    return urls;
  }

  for (const [match] of matches) {
    try {
      urls.push(
        new URL(
          match
            .slice(4, match.length - 1)
            .replace(/['"]+/g, '')
            .trim()
        )
      );
    } catch (e) {
      // noop
    }
  }

  return urls;
};

const checkUrls = (urls: URL[]) => {
  if (urls.length > 0 && urls.filter(isAllowedUrl).length < urls.length) {
    violation(
      `CSS Rule contains an invalid url() -- only [${defaultAllowedUrlSchemes.join(
        ','
      )}] urls are allowed, of image types [${defaultAllowedUrlDataTypes.join(',')}]`,
      urls
    );
    return false;
  }

  return true;
};

export const createCssFilter = () => {
  const parser = postcss();
  return (rules: string) =>
    parser.process(rules, { from: undefined }).then((result) => {
      result.root.walk((node, idx) => {
        if (node instanceof Declaration) {
          if (!checkUrls(parseUrls(node.value))) {
            node.remove();
          }
        }
      });
      return result.root.toResult();
    });
};

export const createStyleDeclarationProxy = (context: QuickJSAsyncContext, node: HTMLElement) => {
  return createObjectProxy({
    context,
    target: node.style,
    handler: {
      guard(op) {
        if (!Object.prototype.hasOwnProperty.call(node.style, op.prop)) {
          return false;
        }

        if (typeof node.style[op.prop] !== 'string') {
          return false;
        }

        if (op.type === 'set') {
          if (typeof op.value !== 'string') {
            return false;
          }

          return checkUrls(parseUrls(op.value));
        }

        return true;
      }
    }
  });
};

// Partial implementation of ServerStyleSheet from 'styled-components'
export const createSandboxStyleSheet = (context: QuickJSAsyncContext, sheet: CSSStyleSheet) => {
  const filter = createCssFilter();

  const globalStyles: Record<string, number> = {};
  const names = new Map<string, Set<string>>();
  const rulesMap = new Map<string, number[]>();

  return createObjectFromDefinition({
    context: context,
    definition: {
      hasNameForId: (hId, hName) => {
        const id = context.getString(hId);
        const name = context.getString(hName);
        return names.has(id) && names.get(id)!.has(name) ? context.true : context.false;
      },
      insertRules: (hId, hName, hRules) => {
        const id = context.getString(hId);
        const name = context.getString(hName);

        if (names.has(id)) {
          names.get(id)!.add(name);
        } else {
          names.set(id, new Set<string>().add(name));
        }

        const input = context.dump(hRules);
        const rules = Array.isArray(input) ? input : [input];

        Promise.all(rules.map((rule) => filter(rule).then(({ css }) => css && sheet.insertRule(css)))).then((ruleIds) =>
          rulesMap.set(
            id,
            ruleIds.map((n) => Number(n))
          )
        );

        return context.undefined;
      },
      allocateGSInstance: (hId) => {
        const id = context.getString(hId);
        return context.newNumber((globalStyles[id] = (globalStyles[id] || 0) + 1));
      },
      clearRules(hId) {
        const id = context.getString(hId);
        const ruleIds = rulesMap.get(id);

        if (ruleIds) {
          ruleIds.map((rule) => sheet.deleteRule(rule));
          rulesMap.delete(id);
          names.delete(id);
          delete globalStyles[id];
        }
      }
    },
    hObject: undefined,
    warnOnDispose: false
  });
};
