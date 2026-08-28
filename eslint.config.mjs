// Scope checking, deliberately narrow.
//
// This config exists for one rule: no-undef. A helper was once placed inside a component
// body instead of at module scope; it compiled cleanly, `vite build` passed, and the app
// then threw "Can't find variable" at render and failed to load for everyone. no-undef
// catches exactly that, and a browser smoke test does not — the fault was on a screen
// that only appears after login.
//
// Run `npm run lint` before pushing. A clean run must mean something, so it is wired to
// exit non-zero on warnings too (--max-warnings 0 in the npm script).
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}', 'tools/**/*.mjs'],
    // react-hooks is registered only so the existing exhaustive-deps disable comment in
    // App.jsx resolves to a known rule. None of its rules are switched on — an unknown
    // rule named in an inline comment is itself an error, and suppressing inline config
    // instead makes every run emit a warning, so no run is ever clean.
    plugins: { 'react-hooks': reactHooks },
    // The disable comment is legitimate — it documents a deliberate dependency omission —
    // but exhaustive-deps is not switched on here, so ESLint would flag the directive as
    // unused. Don't report that; this config only checks scope.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly', navigator: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
        clearInterval: 'readonly', requestAnimationFrame: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly',
        Blob: 'readonly', URL: 'readonly', FileReader: 'readonly', File: 'readonly',
        FormData: 'readonly', Image: 'readonly', ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly', MutationObserver: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        btoa: 'readonly', atob: 'readonly', structuredClone: 'readonly',
        process: 'readonly', globalThis: 'readonly',
        // Loaded from a CDN <script> in index.html, not bundled.
        html2pdf: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },
];
