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
