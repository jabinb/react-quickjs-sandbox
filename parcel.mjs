import { fileURLToPath } from 'url';
import { Parcel } from '@parcel/core';

const bundler = new Parcel({
  entries: ['example/index.html'],
  defaultConfig: '@parcel/config-default',
  mode: process.env.NODE_ENV,
  targets: {
    main: {
      publicUrl: '.',
      distDir: 'build',
      context: 'browser',
      includeNodeModules: true,
      engines: {
        browsers: 'Chrome 99'
      },
    }
  },
  additionalReporters: [
    {
      packageName: '@parcel/reporter-cli',
      resolveFrom: fileURLToPath(import.meta.url)
    }
  ],
  env: {
    NODE_ENV: process.env.NODE_ENV
  }
});

const build = await bundler.run();
console.log(`✨ Build finished in ${build.buildTime}.`);
