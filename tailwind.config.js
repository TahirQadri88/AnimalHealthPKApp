export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Two roles, set by CSS variables so a font choice is one line in index.css:
      // `ui` for everything you read and type, `display` for headings and money.
      fontFamily: {
        ui: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      // Khyber Traders, from the brand skill: Khyber Yellow and black, bone and the stone
      // greys for neutrals, signal red for cautions only. `kt-` so they cannot collide with
      // Tailwind's own `stone`. Used by the Billing screen first (the unslop trial).
      // Each colour is a CSS variable holding "R G B", so a palette (or, later, a dark mode)
      // is a set of variables in index.css, and opacity modifiers like bg-kt-red/10 still work.
      colors: {
        kt: Object.fromEntries(['yellow', 'ink', 'sub', 'muted', 'page', 'raised', 'line', 'band', 'primary',
          'red', 'amber', 'green', 'blue'].map(n => [n, `rgb(var(--kt-${n}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
}
