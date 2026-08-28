// Scope checking, deliberately narrow.
//
// This config exists for one rule: no-undef. A helper was once placed inside a component
// body instead of at module scope; it compiled cleanly, `vite build` passed, and the app
// then threw "Can't find variable" at render and failed to load for everyone. no-undef
// catches exactly that, and a browser smoke test does not — the fault was on a screen
// that only appears after login.
//
// Run `npm run lint` before pushing. Keep it quiet enough that a clean run means
// something; if it starts reporting noise, fix the noise rather than ignoring the run.
export default [
  {
    files: ['src/**/*.{js,jsx}', 'tools/**/*.mjs'],
    linterOptions: {
      // The source carries a react-hooks/exhaustive-deps disable comment. That plugin is
      // not installed here, and an unknown rule in an inline comment is itself an error,
      // so inline config is ignored. Nothing in this config needs suppressing anyway.
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'off',
    },
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
