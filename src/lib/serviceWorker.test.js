// The service worker is not bundled, not linted and not importable — it is a separate
// script the browser runs on its own. So these are source checks, which is the only kind
// available, and they guard the two mistakes this file is easy to make.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const SW = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

describe('public/sw.js', () => {
  it('is valid JavaScript — nothing else checks this', () => {
    expect(() => new Script(SW)).not.toThrow();
  });

  // A connection that is present but dead does not fail; the fetch sits there until the
  // browser gives up, with every asset already in the cache beside it.
  it('caps how long a network-first fetch may wait', () => {
    expect(SW).toMatch(/NETWORK_TIMEOUT_MS\s*=\s*\d+/);
    const ms = Number(SW.match(/NETWORK_TIMEOUT_MS\s*=\s*(\d+)/)[1]);
    expect(ms).toBeGreaterThan(1000);   // shorter than this cuts off a slow but working reply
    expect(ms).toBeLessThan(10000);     // longer stops being a fix
  });

  it('puts both network-first paths through it', () => {
    // The document, and the hashed JS/CSS.
    const navigate = SW.slice(SW.indexOf("request.mode === 'navigate'"));
    expect(navigate.slice(0, 400)).toContain('networkFirst');
    const assets = SW.slice(SW.indexOf("url.includes('/assets/')"));
    expect(assets.slice(0, 300)).toContain('networkFirst');
  });

  // Cutting off a Firestore long-poll at three seconds would break the realtime listeners.
  // The SDK knows far more than this worker does about when to give up.
  it('leaves Firebase requests alone', () => {
    const firebase = SW.slice(SW.indexOf("url.includes('firestore')"));
    expect(firebase.slice(0, 300)).not.toContain('networkFirst');
  });

  // The activate handler deletes every cache whose name does not match, so bumping the name
  // is what actually evicts the old one. Forgetting it means testing the previous worker
  // and concluding the change did nothing.
  it('carries a versioned cache name', () => {
    expect(SW).toMatch(/CACHE_NAME\s*=\s*'animalhealth-v\d+'/);
  });

  // Recorded in the file itself: a cached index.html once pinned the browser to a build
  // whose crash had already been fixed and deployed.
  it('never serves the document cache-first', () => {
    const navigate = SW.slice(SW.indexOf("request.mode === 'navigate'"), SW.indexOf("url.includes('/assets/')"));
    expect(navigate.indexOf('networkFirst')).toBeLessThan(navigate.indexOf('caches.match'));
  });
});
