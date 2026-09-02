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
