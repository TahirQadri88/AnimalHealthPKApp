import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { METRIC_INFO } from './metricInfo';

// Every ⓘ on the Analytics screen must have something to say, and every explanation must be
// one a screen actually uses: a key typed wrong renders nothing at all, silently.
const src = readFileSync(new URL('../../components/admin/AnalyticsView.jsx', import.meta.url), 'utf8');
const used = new Set([
  ...[...src.matchAll(/InfoTip[^>]*\bk="([a-zA-Z]+)"/g)].map(m => m[1]),
  ...[...src.matchAll(/\binfo: '([a-zA-Z]+)'/g)].map(m => m[1]),
  ...[...src.matchAll(/'[A-Z][A-Za-z ]+': '([a-zA-Z]+)'/g)].map(m => m[1]).filter(k => k in METRIC_INFO),
]);

describe('metricInfo', () => {
  it('every entry says what it means and how, briefly', () => {
    Object.entries(METRIC_INFO).forEach(([k, m]) => {
      expect(m.label, k).toBeTruthy();
      expect(m.means.length, k).toBeGreaterThan(15);
      expect(m.how.length, k).toBeGreaterThan(10);
      expect(m.means.length + m.how.length, k).toBeLessThan(330);
    });
  });
  it('every key the screen uses exists', () => {
    expect(used.size).toBeGreaterThan(20);
    [...used].forEach(k => expect(METRIC_INFO[k], k).toBeTruthy());
  });
});
