// Renders the receivables aging document the way a print actually would.
//
// The smoke test only reaches the login screen, so nothing in this repo has ever exercised
// a PrintView layout. This does: it renders the real component to static markup at all
// three paper sizes and asserts the numbers reach the page. It would have caught a bad
// key name silently rendering "undefined" or "NaN" onto a sheet handed to a customer.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';
import { AGING_BUCKETS } from '../services/analytics/receivables';

const AGING = {
  asOf: '2026-08-30',
  buckets: AGING_BUCKETS.map(b => ({ key: b.key, label: b.label })),
  rows: [
    { name: 'Ghousia Farms', phone: '0300-1234567', oldestAgeDays: 182,
      buckets: { current: 0, d31_60: 0, d61_90: 0, d90plus: 118500 }, totalOutstanding: 118500 },
    { name: 'Al Shaheer Poultry', phone: '', oldestAgeDays: 45,
      buckets: { current: 4000, d31_60: 2500, d61_90: 0, d90plus: 0 }, totalOutstanding: 6500 },
  ],
  totals: { current: 4000, d31_60: 2500, d61_90: 0, d90plus: 118500 },
  grandTotal: 125000,
  customerCount: 2,
};

const render = (format, aging = AGING) => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType: 'report', format, data: {
      title: 'Receivables Aging', dateFilter: 'As at 30-Aug-26', view: 'Aging',
      generatedOn: '2026-08-30', appliedFilters: { scope: 'All buckets' }, aging,
    } }}
    setPrintConfig={() => {}}
    products={[]}
    customers={[]}
    getCustomerLedger={() => null}
    getCustomerBalance={() => 0}
    showToast={() => {}}
    appSettings={{}}
  />
);

describe('aging report renders on every paper size', () => {
  ['a4', 'a5', 'thermal'].forEach(format => {
    describe(format, () => {
      const html = render(format);

      it('names every customer who owes', () => {
        expect(html).toContain('Ghousia Farms');
        expect(html).toContain('Al Shaheer Poultry');
      });

      it('prints the grand total and the bucket totals', () => {
        expect(html).toContain('Rs.125,000');
        expect(html).toContain('Rs.118,500');
        expect(html).toContain('Rs.4,000');
      });

      it('shows the age of the oldest debt', () => {
        expect(html).toContain('182');
      });

      it('carries the title, period and filter scope', () => {
        expect(html).toContain('Receivables Aging');
        expect(html).toContain('As at 30-Aug-26');
        expect(html).toContain('All buckets');
      });

      // A missing key renders as the word itself; that must never reach paper.
      it('leaks no undefined or NaN', () => {
        expect(html).not.toMatch(/undefined|NaN/);
      });
    });
  });

  it('offers the thermal size for aging but not for an analytics report', () => {
    expect(render('a4')).toContain('>Thermal<');
    const analytics = renderToStaticMarkup(
      <PrintView
        printConfig={{ docType: 'report', format: 'a4', data: { title: 'Analytics - By Product', view: 'By Product', rows: [], stats: {} } }}
        setPrintConfig={() => {}} products={[]} customers={[]}
        getCustomerLedger={() => null} getCustomerBalance={() => 0} showToast={() => {}} appSettings={{}}
      />
    );
    expect(analytics).not.toContain('>Thermal<');
  });

  it('says so plainly rather than printing an empty table', () => {
    const html = render('a4', { ...AGING, rows: [], totals: { current: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, grandTotal: 0, customerCount: 0 });
    expect(html).toContain('Nothing outstanding');
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
