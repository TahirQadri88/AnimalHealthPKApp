// The transactions behind a breakdown row, rendered.
//
// The arithmetic is tested in services/analytics/drilldown.test.js, which reconciles every
// dimension against the reportEngine row it was opened from. This covers the screen: that
// the documents reach it, that a return reads as one, and that nothing arrives as undefined.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DrillDownModal } from './DrillDownModal';
import { drillDown } from '../../services/analytics/drilldown';

const PRODUCTS = [{ id: 1, name: 'Antox 9', companyId: 10 }];
const CUSTOMERS = [{ id: 1, name: 'Al Shaheer', city: 'Karachi' }];
const line = (qty, price, cost, over = {}) =>
  ({ productId: 1, name: 'Antox 9', quantity: qty, price, costPrice: cost, company: 'Selmore', ...over });

const INVOICES = [
  { id: 'INV-8447', date: '2026-08-31', status: 'Billed', customerId: 1, customerName: 'Al Shaheer',
    salespersonName: 'Owais', items: [line(10, 7500, 6000)] },
  { id: 'CN-0009', date: '2026-09-01', status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer',
    salespersonName: 'Owais', reason: 'Damaged in transit', items: [line(2, 7500, 6000)] },
];

const result = (dimension = 'product', key = 'Antox 9') =>
  drillDown({ dimension, key, invoices: INVOICES, products: PRODUCTS, customers: CUSTOMERS });

const render = (over = {}) => renderToStaticMarkup(
  <DrillDownModal result={result()} label="Antox 9" periodLabel="This Month" onClose={() => {}} onOpenLedger={() => {}} {...over} />
);

describe('DrillDownModal', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  it('titles itself with the dimension and the row', () => {
    expect(render()).toContain('Product: Antox 9');
  });

  it('lists every document behind the figure', () => {
    const html = render();
    expect(html).toContain('INV-8447');
    expect(html).toContain('CN-0009');
  });

  // 10 × 7,500 sold less 2 × 7,500 returned.
  it('restates the row from the documents underneath it', () => {
    const html = render();
    expect(html).toContain('Rs.60,000');          // revenue
    expect(html).toContain('Rs.12,000');          // gross profit
    expect(html).toContain('20.0%');              // margin
  });

  it('marks a return, and shows why it came back', () => {
    const html = render();
    expect(html).toContain('Return');
    expect(html).toContain('Damaged in transit');
  });

  it('counts invoices and returns apart', () => {
    expect(render()).toContain('1 invoice · 1 return');
  });

  it('offers the list as CSV', () => {
    expect(render()).toContain('title="CSV"');
  });

  it('offers a route to the customer ledger', () => {
    expect(render()).toContain('title="Open customer ledger"');
  });

  it('withholds the ledger button when no handler is given', () => {
    expect(render({ onOpenLedger: undefined })).not.toContain('Open customer ledger');
  });

  it('says so plainly when the period holds nothing', () => {
    const html = render({ result: result('product', 'Nothing Like This'), label: 'Nothing Like This' });
    expect(html).toContain('No transactions in this period');
    expect(html).not.toContain('title="CSV"');
  });

  it('renders a customer drill-down as well as a product one', () => {
    const html = render({ result: result('customer', '1'), label: 'Al Shaheer' });
    expect(html).toContain('Customer: Al Shaheer');
    expect(html).toContain('INV-8447');
  });

  it('survives a result it was handed nothing for', () => {
    expect(() => renderToStaticMarkup(<DrillDownModal result={null} label="—" onClose={() => {}} />)).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
