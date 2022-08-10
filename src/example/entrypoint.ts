import { createQjsReactSandbox } from '../index';

const renderQjsNative = async () => {
  console.info('Rendering sandbox');
  const bundleUrl = new URL('./sandbox.tsx', import.meta.url).toString();
  const sandbox = await fetch(bundleUrl)
    .then((response) => response.text())
    .then((source) => {
      const container = document.createElement('main');
      document.body.appendChild(container);
      return createQjsReactSandbox({
        container,
        source,
        extraGlobalsDefinition: {
          test: 'hi'
        }
      });
    });

  sandbox.context.unwrapResult(
    await sandbox.context.evalCodeAsync(`
      import * as React from 'https://google.com/react';  
      console.log(React);
    `)
  );

  // setTimeout(() => {
  //   console.info('Self destructing for testing purposes', sandbox);
  //   sandbox.disposeContext();
  //
  //   setTimeout(renderQjsNative, 1000);
  // }, 5000);
};

window.addEventListener('load', renderQjsNative);
