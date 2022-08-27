import { createQjsReactSandbox } from '../src';
import typescript, { JsxEmit, ModuleKind, ScriptTarget } from 'typescript';
import { debounce } from 'ts-debounce';
declare const editor: any;

const exampleSource = ` 
import React from 'react';
import { createRoot } from 'react-dom/client';
import styled, { createGlobalStyle, StyleSheetManager } from 'styled-components';

const root = createRoot(createSandboxRootDomElement('div'));

export const Title = styled.h1<{ counter: number }>\`
  font-size: $\{({ counter }) => counter + 10}px;
  text-align: center;
  color: palevioletred;
  content: url('https://picsum.photos/536/354');
  background: url(data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7);
\`;

function Text() {
  return <span>hi</span>;
}

const GlobalStyleTwo = createGlobalStyle\`
  h1 {
    background: teal;
  }
\`;



root.render(
  <StyleSheetManager sheet={createSandboxStyleSheet()}>
    <GlobalStyleTwo />
    <Title counter={100}>Hi there</Title>
    <Text />
  </StyleSheetManager>
);
`;

const transpile = (source: string) => {
  const result = typescript.transpile(source, {
    noEmitOnError: true, //
    strict: true,
    jsx: JsxEmit.ReactJSX,
    isolatedModules: true,
    target: ScriptTarget.ES2020,
    module: ModuleKind.ES2020
  });

  console.log(result);
  return result;
};

const createSandbox = debounce((source: string) => {
  const root = document.getElementById('root')!;

  root.innerHTML = '';
  const container = document.createElement('main');
  root.appendChild(container);
  // editor?.setValue(source);

  return createQjsReactSandbox({
    container,
    source: transpile(source),
    extraGlobalsDefinition: {
      test: 'hi'
    }
  });
}, 500);

const renderQjsNative = async () => {
  console.info('Rendering sandbox');
  editor?.setValue(exampleSource);
  let sandbox = await createSandbox(exampleSource);

  editor.session.on('change', async () => {
    if (sandbox.context.alive) {
      await sandbox.disposeContext();
    }
    await createSandbox(editor.getValue());
  });
};

window.addEventListener('load', renderQjsNative);
