// The indicator, rendered in each of its four states.
//
// The derivation is tested in lib/syncStatus.test.js; this covers what reaches the screen,
// and in particular the two sentences the panel exists to deliver.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SyncPill } from './SyncPill';
import { publishCollectionMeta, publishOnline, __resetSyncStatus } from '../../lib/syncStatus';

beforeEach(() => __resetSyncStatus());

// useEffect does not run under SSR, so the store is driven directly.
const render = () => renderToStaticMarkup(<SyncPill />);

describe('SyncPill', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  // A badge that is always lit stops being read, and §34 warns against an app that shouts.
  it('says nothing at all when everything is saved', () => {
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    const html = render();
    expect(html).toContain('Connection: live');
    expect(html).not.toContain('Offline');
    expect(html).not.toContain('Syncing');
  });

  it('says Offline when the browser is offline', () => {
    publishOnline(false);
    expect(render()).toContain('Offline');
  });

  it('counts the changes still to send', () => {
    publishCollectionMeta('invoices', { fromCache: false, pending: 3 });
    const html = render();
    expect(html).toContain('Syncing 3');
    expect(html).toContain('3 changes waiting to sync');
  });

  // The failure navigator.onLine cannot see.
  it('warns when the browser claims online but nothing reaches the server', () => {
    publishCollectionMeta('invoices', { fromCache: true, pending: 0 });
    expect(render()).toContain('No connection');
  });

  it('carries a label a screen reader can use', () => {
    publishOnline(false);
    expect(render()).toContain('aria-label="Connection: offline"');
  });

  it('leaks no undefined into the markup', () => {
    publishCollectionMeta('invoices', { fromCache: true, pending: 2 });
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
