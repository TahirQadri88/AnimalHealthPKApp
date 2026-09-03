// Purity of the move: node tools/extraction-diff.mjs AnalyticsView src/components/admin/AnalyticsView.jsx
//
// The report engine behind this screen is tested separately in
// services/analytics/reportEngine.test.js — 15 tests on the arithmetic. These cover the
// screen: that the figures reach it, and that the exports are offered.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { AnalyticsView } from './AnalyticsView';

const today = new Date().toISOString().slice(0, 10);
const line = (name, qty, price, cost) => ({ productId: 1, name, quantity: qty, price, costPrice: cost, company: 'Selmore' });
const INVOICES = [
  { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer',
    salespersonId: 1, salespersonName: 'Owais', total: 75000, items: [line('Antox 9', 10, 7500, 6000)] },
  { id: 'CN-1', date: today, status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer',
    salespersonId: 1, salespersonName: 'Owais', total: 15000, items: [line('Antox 9', 2, 7500, 6000)] },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    getPaymentStatus: () => 'Pending', isAdmin: true, currentUser: { id: 1, name: 'Owais', role: 'admin' },
    companies: [{ id: 1, name: 'Selmore' }], products: [], customers: [{ id: 1, name: 'Al Shaheer' }],
    invoices: INVOICES, expenses: [], expenseCategories: [], payments: [], appUsers: [],
    cities: [], areas: [], customerTypes: [],
    analyticsView: '', setAnalyticsView: () => {},
    getCustomerBalance: () => 60000, getCompanyName: () => 'Selmore',
    setPrintConfig: () => {}, showToast: () => {}, setActiveTab: () => {}, setAdminView: () => {},
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {},
    ...over,
  }}>
    <AnalyticsView />
  </AppContext.Provider>
);

describe('AnalyticsView', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  // 75,000 billed less 15,000 returned. Both this and the Home dashboard net returns now;
  // they disagreed until 2026-09-01.
  it('shows product sales net of returns', () => {
    expect(render()).toContain('60,000');
  });

  it('offers the period filters', () => {
    const html = render();
    ['Today', 'This Week', 'This Month', 'This Year', 'All Time'].forEach(f => expect(html).toContain(f));
  });

  // The export buttons are icon-only, identified by their title. CSV is deliberately absent
  // on Overview — there is nothing tabular to export there, and the handler says so with a
  // toast if it is ever reached.
  // Every tab offers the same three now. Overview used to hide CSV and answer a press with
  // an error toast; it exports the same P&L rows Insights does.
  it('offers WhatsApp, CSV and the document on every tab', () => {
    ['Overview', 'Insights', 'By Product', 'Receivables', 'Collections', 'Returns', 'Item Sales'].forEach(v => {
      const html = render({ analyticsView: v });
      expect(html).toContain('title="WhatsApp"');
      expect(html).toContain('title="CSV"');
      expect(html).toContain('title="PDF, Image or Save — opens the document"');
    });
  });

  it('renders for a business with no data', () => {
    expect(() => render({ invoices: [], customers: [], getCustomerBalance: () => 0 })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  // byCustomer is keyed by customer ID now, so the screen must print the label. Getting this
  // wrong shows a bare "1" where the customer's name belongs.
  it('names the customer on the By Customer table rather than printing its id', () => {
    const html = render({ analyticsView: 'By Customer' });
    expect(html).toContain('Al Shaheer');
    expect(html).not.toMatch(/>\s*1\s*<\/button>/);
  });

  it('does not merge two customers who happen to share a name', () => {
    const html = render({
      analyticsView: 'By Customer',
      customers: [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Al Shaheer' }],
      invoices: [
        { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer', total: 75000, items: [line('Antox 9', 10, 7500, 6000)] },
        { id: 'INV-2', date: today, status: 'Billed', customerId: 2, customerName: 'Al Shaheer', total: 4000, items: [line('Ratava', 2, 2000, 1500)] },
      ],
    });
    expect(html).toContain('2 Customers');
  });
});

// Aging was computed twice and the Analytics copy aged a balance by the last SALE. It is
// buildAgingReport now, so a fresh purchase can no longer pull an old debt into "Current".
describe('AnalyticsView — Receivables', () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const OLD_AND_NEW = {
    analyticsView: 'Receivables',
    customers: [{ id: 1, name: 'Ghousia Farms', phone: '0300-1234567' }],
    getCustomerBalance: () => 120000,
    invoices: [
      { id: 'INV-OLD', date: daysAgo(200), status: 'Billed', customerId: 1, customerName: 'Ghousia Farms', total: 118500, items: [line('Antox 9', 1, 118500, 90000)] },
      { id: 'INV-NEW', date: daysAgo(2), status: 'Billed', customerId: 1, customerName: 'Ghousia Farms', total: 1500, items: [line('Ratava', 1, 1500, 1000)] },
    ],
  };

  it('leaves a 200-day-old debt in the 90+ bucket after a purchase yesterday', () => {
    const html = render(OLD_AND_NEW);
    const bucket = html.slice(html.indexOf('90+ days'));
    expect(bucket).toContain('118,500');
  });

  it('splits the same customer across buckets rather than filing them under one', () => {
    const html = render(OLD_AND_NEW);
    expect(html).toContain('0–30 days');
    expect(html).toContain('90+ days');
    expect(html).toContain('1,500');
  });

  it('says how old the debt is, not how long since the last invoice', () => {
    expect(render(OLD_AND_NEW)).not.toContain('since last invoice');
  });

  it('still offers a WhatsApp reminder against the balance', () => {
    expect(render(OLD_AND_NEW)).toContain('wa.me/923001234567');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(OLD_AND_NEW)).not.toMatch(/undefined|NaN/);
  });
});

// Every breakdown row is a button now. The row's figure and the documents behind it should
// be one click apart, in every dimension — before this, only the customer rows led anywhere
// and only to the ledger.
describe('AnalyticsView — drill-down', () => {
  ['By Product', 'By Company', 'By Customer', 'By City', 'By Area', 'By Type'].forEach(v => {
    it(`offers a drill-down from the ${v} table`, () => {
      const html = render({
        analyticsView: v,
        customers: [{ id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' }],
      });
      expect(html).toContain('Show the transactions behind');
    });
  });

  it('leaks no undefined into a segment table', () => {
    const html = render({
      analyticsView: 'By City',
      customers: [{ id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' }],
    });
    expect(html).not.toMatch(/undefined|NaN/);
  });
});

// Money in. For a business run on credit this was the largest missing dimension: two
// numbers about collection existed and no view of the cash itself.
describe('AnalyticsView — Collections', () => {
  const WORLD = {
    analyticsView: 'Collections',
    customers: [{ id: 1, name: 'Al Shaheer' }],
    invoices: [
      { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer',
        salespersonName: 'Owais', total: 136000, receivedAmount: 136000, items: [line('Antox 9', 10, 13600, 10000)] },
    ],
    payments: [{ id: 'REC-1', date: today, customerId: 1, amount: 20000, discount: 500, note: 'Cheque No. 88213' }],
  };

  it('counts the cash taken at the counter, not only the receipts', () => {
    const html = render(WORLD);
    expect(html).toContain('Rs.156,000');   // 136,000 at billing + 20,000 receipt
    expect(html).toContain('Rs.136,000');
    expect(html).toContain('Rs.20,000');
  });

  it('shows the round-off discount apart, as money never received', () => {
    expect(render(WORLD)).toContain('never received');
  });

  it('breaks the money down by method, and says where the method came from', () => {
    const html = render(WORLD);
    expect(html).toContain('Cheque');
    expect(html).toContain('At billing');
    expect(html).toContain('there is no method field');
  });

  it('attributes counter cash to the salesperson on the bill', () => {
    expect(render(WORLD)).toContain('Owais');
  });

  it('lists every collection with its reference', () => {
    const html = render(WORLD);
    expect(html).toContain('INV-1');
    expect(html).toContain('REC-1');
  });

  it('offers the list as CSV', () => {
    expect(render(WORLD)).toContain('title="CSV"');
  });

  it('says so plainly when nothing came in', () => {
    const html = render({ analyticsView: 'Collections', invoices: [], payments: [], customers: [] });
    expect(html).toContain('Nothing came in during this period');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(WORLD)).not.toMatch(/undefined|NaN/);
  });
});

// The reason a return came back is typed onto every credit note and nothing read it.
describe('AnalyticsView — Returns', () => {
  const WORLD = {
    analyticsView: 'Returns',
    customers: [{ id: 1, name: 'Al Shaheer' }],
    invoices: [
      { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer', total: 75000, items: [line('Antox 9', 10, 7500, 6000)] },
      { id: 'CN-1', date: today, status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer', reason: 'Expired', originalInvoiceId: 'INV-1', total: 15000, items: [line('Antox 9', 2, 7500, 6000)] },
      { id: 'CN-2', date: today, status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer', reason: '', total: 7500, items: [line('Antox 9', 1, 7500, 6000)] },
    ],
  };

  it('shows what came back and what it was worth', () => {
    const html = render(WORLD);
    expect(html).toContain('Rs.22,500');
    expect(html).toContain('CN-1');
    expect(html).toContain('CN-2');
  });

  it('states the return rate against gross sales', () => {
    // 22,500 of 75,000 billed.
    expect(render(WORLD)).toContain('30%');
  });

  it('shows the reason, and names the ones left blank', () => {
    const html = render(WORLD);
    expect(html).toContain('Expired');
    expect(html).toContain('No reason recorded');
    expect(html).toContain('with no reason recorded');
  });

  it('links a credit note back to the invoice it came from', () => {
    expect(render(WORLD)).toContain('ref INV-1');
  });

  it('offers the list as CSV', () => {
    expect(render(WORLD)).toContain('title="CSV"');
  });

  it('says so plainly when nothing came back', () => {
    const html = render({ analyticsView: 'Returns', invoices: [], customers: [] });
    expect(html).toContain('Nothing came back this period');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(WORLD)).not.toMatch(/undefined|NaN/);
  });
});

// Ranking on revenue or profit alone makes a high-turnover low-margin line look like the
// best in the business.
describe('AnalyticsView — margin as a ranking', () => {
  it('offers best and worst margin as sorts on a breakdown table', () => {
    const html = render({ analyticsView: 'By Product' });
    expect(html).toContain('Sort: Best Margin');
    expect(html).toContain('Sort: Worst Margin');
  });

  it('offers them on a segment table too, which had no sort at all', () => {
    const html = render({
      analyticsView: 'By City',
      customers: [{ id: 1, name: 'Al Shaheer', city: 'Karachi' }],
    });
    expect(html).toContain('Sort: Best Margin');
  });
});

// A bar list on Insights was everything Analytics had to say about expenses.
describe('AnalyticsView — Expenses', () => {
  const WORLD = {
    analyticsView: 'Expenses',
    expenseCategories: [{ id: 1, name: 'Petrol', group: 'Transportation' }],
    expenses: [
      { id: 1, date: today, category: 'Petrol', amount: 5000 },
      { id: 2, date: today, category: 'Chai', amount: 800 },
    ],
  };

  it('totals the period and lists every entry', () => {
    const html = render(WORLD);
    expect(html).toContain('Rs.5,800');
    expect(html).toContain('Petrol');
    expect(html).toContain('Chai');
  });

  it('rolls a category up into its group, and names one with no record', () => {
    const html = render(WORLD);
    expect(html).toContain('Transportation');
    expect(html).toContain('Ungrouped');
  });

  it('offers a comparison to the period before', () => {
    expect(render(WORLD)).toContain('vs Previous Period');
  });

  it('says so plainly when nothing was spent', () => {
    expect(render({ analyticsView: 'Expenses', expenses: [] }))
      .toContain('Nothing was spent in this period');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(WORLD)).not.toMatch(/undefined|NaN/);
  });
});

describe('AnalyticsView — two figures that were computed and never shown', () => {
  it('shows what was billed in the period, which totalBilledAmt already knew', () => {
    expect(render({ analyticsView: 'Insights' })).toContain('Billed This Period');
  });

  // The monthly chart deliberately ignores the filter and said nothing, so it disagreed
  // silently with every other figure on the page.
  it('says the monthly trend ignores the period filter', () => {
    expect(render({ analyticsView: 'Monthly Trend' }))
      .toContain('this view ignores the');
  });
});
