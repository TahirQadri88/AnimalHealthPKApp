import { defineConfig } from 'vite';

// Separate config because the main one excludes this suite from `npm run verify` — it
// needs a JVM and the Firestore emulator jar, neither of which belongs in the fast loop.
// `npm run test:rules` starts the emulator around it.
export default defineConfig({
  test: {
    include: ['tools/firestore-rules.test.mjs'],
    // Rules evaluation goes over the wire to the emulator; the default 5s is tight when
    // the JVM is still warming up on the first assertion.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
