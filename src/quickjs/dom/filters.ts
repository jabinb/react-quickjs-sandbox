export interface FilterFunctions {
  isTagAllowed: (tag: string) => boolean;
  isAttributeAllowed: (element: Element, name: string) => boolean;
  isInputTypeAllowed: (name: string) => boolean;
  isAllowedUrl: (url: URL) => boolean;
}

export const isAllowedUrl = (url: URL): boolean => {
  return (
    defaultAllowedUrlSchemes.includes(url.protocol) &&
    defaultAllowedUrlDataTypes.includes(url.pathname.slice(6, 10).replace(/;$/, ''))
  );
};

export const isTagAllowed = (tag: string) => defaultAllowedTags.includes(tag);
export const isAttributeAllowed = (element: Element, name: string) => defaultAllowedAttributes.includes(name);
export const getAttributePropertyEquivalent = (name: string) =>
  name in defaultAllowedPropertyAttributes
    ? defaultAllowedPropertyAttributes[name as keyof typeof defaultAllowedPropertyAttributes]
    : null;
export const isInputTypeAllowed = (type: string) => defaultAllowedInputTypes.includes(type);

export const defaultAllowedUrlDataTypes = ['gif', 'png', 'jpeg'];
export const defaultAllowedUrlSchemes = ['data:'];

export const defaultAllowedPropertyAttributes = {
  class: 'className',
  rowspan: 'rowSpan',
  datetime: 'dateTime',
  colspan: 'colSpan'
};

export const defaultAllowedInputTypes: string[] = [
  'button',
  'checkbox',
  'color',
  'email',
  'hidden',
  'number',
  'password',
  'radio',
  'range',
  'text',
  'time',
  'url',
  'week'
];

export const defaultAllowedAttributes = [
  'value',
  'defaultSelected',
  'class',
  'alt',
  'cite',
  'colspan',
  'controls',
  'datetime',
  'default',
  'disabled',
  'dir',
  'height',
  'href',
  'id',
  'kind',
  'label',
  'lang',
  'loading',
  'loop',
  'rel',
  'role',
  'rowspan',
  'scope',
  'sizes',
  'span',
  'start',
  'target',
  'title',
  'type',
  'width',
  'minlength',
  'maxlength',
  'min',
  'max',
  'step',
  'placeholder',
  'spellcheck',
  'readonly',
  'name',
  'autocorrect',
  'tabindex',
  'data-column-id',
  'data-sort-id',
  'data-tag',
  'label',
  // svg
  'd',
  'viewBox',
  'aria-hidden',
  'focusable',
  'fill',
  'xmlns'
];

export const defaultAllowedTags: string[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'div',
  'section',
  'dd',
  'dl',
  'dt',
  'hr',
  'ol',
  'p',
  'pre',
  'ul',
  'li',
  'abbr',
  'b',
  'br',
  'cite',
  'code',
  'em',
  'i',
  'kbd',
  'q',
  's',
  'strong',
  'sub',
  'sup',
  'span',
  'time',
  'u',
  'var',
  'del',
  'ins',
  'caption',
  'col',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'datalist',
  'input',
  'button',
  'label',
  'meter',
  'progress',
  'select',
  'option',
  'textarea',
  'details',
  'summary',
  'dialog',
  'svg',
  'path'
];
