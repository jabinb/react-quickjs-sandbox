import React from 'react';
import { createRoot } from 'react-dom/client';
import { createGlobalStyle, StyleSheetManager } from 'styled-components';
import { Discord } from '@styled-icons/boxicons-logos/Discord';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TickingText } from './components/TickingText';
import { Counter } from './components/Counter';

declare const createSandboxRootDomElement: (type: string) => Element;
declare const createSandboxStyleSheet: () => any;

export const root = createRoot(createSandboxRootDomElement('div'));

const GlobalStyleTwo = createGlobalStyle`
  h1 {
    background: teal;
  }
`;

const App = (
  <StyleSheetManager sheet={createSandboxStyleSheet()}>
    <ErrorBoundary>
      <GlobalStyleTwo />
      <TickingText interval={1} />
      <Counter />
      <Discord height={64} />
    </ErrorBoundary>
  </StyleSheetManager>
);

root.render(App);

// console.log(eval("import('react')"));
