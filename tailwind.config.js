export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Khyber Traders, from the brand skill: Khyber Yellow and black, bone and the stone
      // greys for neutrals, signal red for cautions only. `kt-` so they cannot collide with
      // Tailwind's own `stone`. Used by the Billing screen first (the unslop trial).
      colors: {
        kt: {
          yellow: '#FFF200',   // the brand signature: one block per screen, always with black text
          ink: '#1F1B16',      // primary text
          sub: '#5E554A',      // secondary text, labels
          muted: '#6B675C',    // meta and icons (stone)
          page: '#F6F3EA',     // bone
          raised: '#F1EDE3',   // inputs at rest, hover, inner panels
          line: '#E7E3D8',     // hairlines (stone)
          charcoal: '#141414', // primary buttons
          red: '#B42318',      // returns and warnings
          amber: '#B45309',    // drafts and part-paid
          green: '#15803D',    // paid
          blue: '#3F5F8F',     // estimates
        },
      },
    },
  },
  plugins: [],
}
