// Purity of the move: node tools/extraction-diff.mjs AppSettingsView src/components/admin/AppSettingsView.jsx
//
// The business profile that every printed document reads, and the backup schedule. Moved,
// not refactored — this screen writes appSettings, and a full write of that document is
// what silently reverted a user's edit once (see CLAUDE.md, "Writing a whole document back
// is how an edit gets undone").
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { AppSettingsView } from './AppSettingsView';

const SETTINGS = {
  id: 'main', businessName: 'Khyber Traders', appName: 'AnimalHealth.PK',
  tagline: 'Wholesale Veterinary Pharmacy · Karachi',
  phone: '0300-1234567', email: 'info@khybertraders.pk', address: 'Jodia Bazar',
  showBusinessNameOnDocs: true, showBusinessNameOnReports: true, backupFreq: 'weekly',
};

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    appSettings: SETTINGS, isAdmin: true,
    appUsers: [], companies: [], products: [], customers: [], invoices: [], expenses: [],
    expenseCategories: [], payments: [], riders: [], transportCompanies: [],
    cities: [], areas: [], customerTypes: [], vehicleTypes: [],
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, ...over,
  }}>
    <AppSettingsView />
  </AppContext.Provider>
);

describe('AppSettingsView', () => {
  it('renders the business profile form', () => {
    const html = render();
    expect(html).toContain('Business Profile');
    expect(html).toContain('Used on invoices, receipts, and all generated documents');
  });

  // Every one of these is read by PrintView. A field that stops being rendered here is a
  // field the user can no longer change, which is how four settings came to do nothing.
  it('offers every field the documents actually read', () => {
    const html = render();
    ['Business / Company Name', 'Tagline', 'Phone', 'Email', 'Address'].forEach(label => {
      expect(html).toContain(label);
    });
  });

  it('offers both name toggles, and both are wired to the documents', () => {
    const html = render();
    expect(html).toContain('Show on Invoices');
    expect(html).toContain('Show on Reports');
  });

  it('shows the maintenance action it owns', () => {
    expect(render()).toContain('Fix');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('renders for a fresh install with no settings document yet', () => {
    expect(() => render({ appSettings: null })).not.toThrow();
  });
});

// The restore half of "Backup & Data Safety" had never been run. It wrote straight from the
// file picker on any JSON at all, and reported success whether or not anything landed.
describe('AppSettingsView — restore', () => {
  it('offers the restore control', () => {
    expect(render()).toContain('Choose Backup .json File');
  });

  // "Overwrites all existing data" was not what the code did. It writes the file's records
  // over the live ones and leaves anything created since the backup exactly where it is.
  it('describes what a restore actually does, not a wipe-and-replace', () => {
    const html = render();
    expect(html).toContain('is left alone');
    expect(html).toContain('not a wipe-and-replace');
    expect(html).not.toContain('Overwrites all existing data.');
  });

  it('promises the file is shown before anything is written', () => {
    expect(render()).toContain('before anything is written');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});

// Everything the offline work built is invisible until it fails. In particular, the browser
// can REFUSE to keep the cache, and nobody would notice until a day's data had gone.
describe('AppSettingsView — ready for offline', () => {
  it('offers the readiness panel', () => {
    const html = render();
    expect(html).toContain('Ready for Offline');
    expect(html).toContain('If the internet fails right now');
  });

  it('lists what would and would not work', () => {
    const html = render();
    expect(html).toContain('App saved on this device');
    expect(html).toContain('Business data on this device');
    expect(html).toContain('Storage kept when space runs low');
    expect(html).toContain('Document numbers reserved');
    expect(html).toContain('Changes waiting to sync');
  });

  // The two limits people meet at the worst moment.
  it('says signing in and user changes always need the internet', () => {
    const html = render();
    expect(html).toContain('Signing in always needs the internet');
    expect(html).toContain('do not sign out if you expect to work offline');
  });

  // No data, no reserved numbers, no service worker: the honest verdict, not a green tick.
  it('does not claim to be ready when nothing has been cached', () => {
    expect(render()).toContain('Not ready to work offline');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});

// Reported from a real device: the panel said the browser had refused persistent storage
// and that "installing usually earns this" — with no way to act on it. Advice is not a fix.
describe('AppSettingsView — fixing the storage refusal', () => {
  it('offers a route to installing when storage was refused', () => {
    // SSR cannot reach navigator.storage, so persistentStorage resolves null and the
    // how-to-fix block is withheld. What must always hold is that the panel never claims
    // the storage question was settled when it was not.
    const html = render();
    expect(html).toContain('Storage kept when space runs low');
    expect(html).not.toContain('Granted.');
  });

  it('does not offer an install button the platform cannot honour', () => {
    // No beforeinstallprompt has been captured under SSR, so no button.
    expect(render()).not.toContain('Install app');
  });
});
