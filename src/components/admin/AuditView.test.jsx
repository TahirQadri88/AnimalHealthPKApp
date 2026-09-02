// The activity log is fetched through the provider (fetchAuditLog), not by importing
// firebase here — that is what makes this file possible at all. Effects do not run under
// SSR, so `entries` stays null and the log tab shows its loading state; the voided list
// comes straight from the raw collections and is fully rendered.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { AuditView } from './AuditView';
import { voidPatch } from '../../services/audit/auditLog';

const USER = { id: 1, name: 'Owais' };
const VOIDED_INVOICE = {
  id: 'INV-8457', status: 'Billed', customerId: 9, total: 75000,
  ...voidPatch({ user: USER, reason: 'Duplicate entry', at: '2026-09-02T10:00:00.000Z' }),
};
const VOIDED_PAYMENT = {
  id: 'REC-0114', customerId: 9, amount: 50000,
  ...voidPatch({ user: USER, reason: 'Wrong client', at: '2026-09-01T09:00:00.000Z' }),
};

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    adminView: 'audit',
    invoicesRaw: [{ id: 'INV-1', status: 'Billed', total: 100 }, VOIDED_INVOICE],
    paymentsRaw: [VOIDED_PAYMENT],
    expensesRaw: [],
    customers: [{ id: 9, name: 'Abdul Qadir Shan Cattle' }],
    fetchAuditLog: async () => [], restoreRecord: () => {},
    showConfirm: () => {}, showToast: () => {}, ...over,
  }}>
    <AuditView />
  </AppContext.Provider>
);

describe('AuditView', () => {
  it('counts what is voided, across all three collections', () => {
    expect(render()).toContain('2 voided records');
  });

  // The voided ROWS live behind the second tab, which opens on a click, so SSR shows the
  // Activity tab only. What the first paint must get right is the tab label's count —
  // that is the number telling an admin whether anything needs looking at.
  it('labels the voided tab with its count', () => {
    expect(render()).toContain('Voided (2)');
  });

  it('renders no record detail on the default tab', () => {
    const html = render();
    expect(html).not.toContain('Duplicate entry');
    expect(html).not.toContain('Abdul Qadir Shan Cattle');
  });

  it('tells the reader the log is a bounded page, not everything', () => {
    expect(render()).toContain('log shows the last 200');
  });

  it('says so plainly when nothing has been voided', () => {
    const html = render({ invoicesRaw: [], paymentsRaw: [], expensesRaw: [] });
    expect(html).toContain('0 voided records');
    expect(html).toContain('Voided (0)');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
