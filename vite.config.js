import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // The rules suite needs a running Firestore emulator, so it is NOT part of
    // `npm run test` / `npm run verify`. Run it with `npm run test:rules`, which starts
    // the emulator around it.
    exclude: ['**/node_modules/**', '**/dist/**', 'tools/firestore-rules.test.mjs'],
  },
})
