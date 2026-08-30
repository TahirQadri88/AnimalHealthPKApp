import { describe, it, expect } from 'vitest';
import { computePnL } from './profitAndLoss';

const item = (price, quantity, costPrice) => ({ price, quantity, costPrice });
const billed = (items, extra = {}) => ({ status: 'Billed', items, ...extra });
const creditNote = (items) => ({ status: 'CreditNote', items });

describe('computePnL', () => {
  it('is all zeroes with no data', () => {
    const p = computePnL();
    expect(p.grossSales).toBe(0);
    expect(p.netProfit).toBe(0);
    expect(p.grossMarginPct).toBe(0);
  });

  it('computes sales, cost and profit from line items', () => {
    const p = computePnL({ billedInvoices: [billed([item(100, 3, 60), item(50, 2, 30)])] });
    expect(p.grossSales).toBe(400);
    expect(p.cogs).toBe(240);
    expect(p.grossProfit).toBe(160);
    expect(p.grossMarginPct).toBe(40);
  });

  // ── The bug this module exists to fix ─────────────────────────────────────
  it('a fully returned sale nets to zero, not to a profit', () => {
    // Old behaviour reported Rs 40 profit on goods that came back: revenue came only from
    // Billed invoices, so the credit note reduced nothing.
    const p = computePnL({
      billedInvoices: [billed([item(100, 1, 60)])],
      creditNotes: [creditNote([item(100, 1, 60)])],
    });
    expect(p.grossSales).toBe(100);
    expect(p.salesReturns).toBe(100);
    expect(p.netSales).toBe(0);
    expect(p.cogs).toBe(0);        // returned goods are no longer a cost of sale
    expect(p.grossProfit).toBe(0);
    expect(p.netProfit).toBe(0);
  });

  it('gross sales is what was invoiced, not inflated by returns', () => {
    // The old P&L printed grossSales + returns on the Gross Sales line.
    const p = computePnL({
      billedInvoices: [billed([item(1000, 1, 600)])],
      creditNotes: [creditNote([item(200, 1, 120)])],
    });
    expect(p.grossSales).toBe(1000);
    expect(p.salesReturns).toBe(200);
    expect(p.netSales).toBe(800);
  });

  it('a partial return reduces profit by the margin on what came back', () => {
    const p = computePnL({
      billedInvoices: [billed([item(100, 10, 60)])],   // 1000 sales, 600 cost, 400 profit
      creditNotes: [creditNote([item(100, 2, 60)])],   // 200 back, 120 cost back
    });
    expect(p.netSales).toBe(800);
    expect(p.cogs).toBe(480);
    expect(p.grossProfit).toBe(320);   // 400 less the 80 margin on the returned units
  });

  it('margin is measured against net sales, not gross', () => {
    const p = computePnL({
      billedInvoices: [billed([item(100, 10, 50)])],
      creditNotes: [creditNote([item(100, 5, 50)])],
    });
    expect(p.netSales).toBe(500);
    expect(p.grossProfit).toBe(250);
    expect(p.grossMarginPct).toBe(50);
  });

  it('keeps only the difference between delivery charged and transport paid', () => {
    const p = computePnL({
      billedInvoices: [billed([item(1000, 1, 600)], { deliveryBilled: 500, transportExpense: 300 })],
    });
    expect(p.deliveryNet).toBe(200);
    expect(p.netProfit).toBe(600); // 400 gross profit + 200 delivery
  });

  it('subtracts operating expenses to reach net profit', () => {
    const p = computePnL({
      billedInvoices: [billed([item(1000, 1, 600)])],
      expenses: [{ amount: 150 }, { amount: 50 }],
    });
    expect(p.operatingExpenses).toBe(200);
    expect(p.netProfit).toBe(200);
  });

  it('reports a loss rather than clamping at zero', () => {
    const p = computePnL({
      billedInvoices: [billed([item(100, 1, 60)])],
      expenses: [{ amount: 500 }],
    });
    expect(p.netProfit).toBe(-460);
  });

  it('honours a line-level filter, on both sales and returns', () => {
    const onlyCompanyA = (it) => it.company === 'A';
    const p = computePnL({
      billedInvoices: [billed([
        { ...item(100, 2, 60), company: 'A' },
        { ...item(500, 1, 300), company: 'B' },
      ])],
      creditNotes: [creditNote([{ ...item(100, 1, 60), company: 'A' }])],
      includeItem: onlyCompanyA,
    });
    expect(p.grossSales).toBe(200);
    expect(p.salesReturns).toBe(100);
    expect(p.netSales).toBe(100);
    expect(p.cogs).toBe(60);
  });

  it('does not produce NaN when a line is missing price or cost', () => {
    const p = computePnL({
      billedInvoices: [billed([{ quantity: 5 }, item(100, 1, undefined)])],
      expenses: [{}],
    });
    expect(Number.isNaN(p.netProfit)).toBe(false);
    expect(p.grossSales).toBe(100);
    expect(p.cogs).toBe(0);
  });

  it('counts documents and averages the invoice value on gross', () => {
    const p = computePnL({
      billedInvoices: [billed([item(100, 1, 60)]), billed([item(300, 1, 200)])],
      creditNotes: [creditNote([item(50, 1, 30)])],
    });
    expect(p.invoiceCount).toBe(2);
    expect(p.creditNoteCount).toBe(1);
    expect(p.averageInvoice).toBe(200);
  });

  it('bonus lines cost without earning, so they cut margin', () => {
    // Bonus items are stored with price 0 but a real costPrice.
    const p = computePnL({
      billedInvoices: [billed([item(100, 10, 60), { price: 0, quantity: 2, costPrice: 60 }])],
    });
    expect(p.grossSales).toBe(1000);
    expect(p.cogs).toBe(720);
    expect(p.grossProfit).toBe(280);
  });
});
