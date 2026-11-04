// Full-app preview: the real app, with src/firebase.js swapped for firebase-stub.js.
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174
//   open http://localhost:5174/tools/ui-preview/app.html   (?as=staff for a staff login)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const real = path.resolve(here, '../../src/firebase.js');
const stub = path.resolve(here, 'firebase-stub.js');

export default defineConfig({
  root: path.resolve(here, '../..'),
  plugins: [react(), {
    name: 'preview-firebase-stub',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !/firebase(\.js)?$/.test(source) || !source.startsWith('.')) return null;
      const resolved = path.resolve(path.dirname(importer), source.endsWith('.js') ? source : `${source}.js`);
      return resolved === real ? stub : null;
    },
  }],
});
