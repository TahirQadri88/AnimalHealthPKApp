// The customer ledger — the financial source of truth.
//
// Extracted verbatim from App.jsx so it can be tested and so every screen computes a
// balance the same way. Behaviour is deliberately unchanged from the inline version.
//
// Money flows in three directions and they all land here:
//   • an invoice puts the customer in debt          (debit)
//   • cash taken at billing time reduces it         (credit, recorded ON the invoice)
//   • a later receipt or a credit note reduces it   (credit, recorded separately)
//
// Payments are held against the CUSTOMER, not against an invoice — there is no invoice id
// on a payment record. That is why per-invoice "Paid" cannot be read straight off the
// payments collection, and why allocateCredits below exists.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Same-day ordering ───────────────────────────────────────────────────────
//
// Dates are date-only strings, so several entries share a timestamp and the tie-break IS
// the ledger's order. An invoice must appear before the cash taken against it, a later
// receipt after both, and a credit note last, or the running balance reads oddly on screen.
//
// The original code encoded that as +1/+2/+3 nudges on the day's timestamp, which made the
// slots per-DAY: with two bills on one day every invoice sorted ahead of every on-invoice
// payment — INV-8475, INV-8476, INV-8475-PAY. So the row immediately preceding the second
// bill was the *unpaid* first bill, and PrintView reads exactly that row for the invoice's
// "Previous Balance". A customer who settled their morning bill in cash still saw it as a
// prior balance on the afternoon one. (Reported 2026-09-03, INV-8475 / INV-8476.)
//
// Cash taken at billing belongs to ITS OWN invoice, so it shares that invoice's timestamp
// and group and sits one slot below it. Grouping is by document id, which is why the id
// comparison moved above the slot: invoices still order among themselves by id, and each
// one's cash row travels with it.
//
// Standalone receipts still land after every invoice of the day — a receipt carries no
// invoice reference, so there is nothing better to pair it with.
const AT_INVOICE = 0;
const AT_PAYMENT = 2;
const AT_CREDIT_NOTE = 3;

// Where an entry sits within its own group. Only the on-invoice payment uses a second slot.
const SLOT_MAIN = 0;
const SLOT_ON_INVOICE_PAYMENT = 1;

export const buildCustomerLedger = (customerId, { customers = [], invoices = [], payments = [] } = {}) => {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return null;

  const openingBal = num(customer.openingBalance);
  const entries = [];

  invoices.filter(o => o.customerId === customerId && o.status === 'Billed').forEach(inv => {
    const itemLines = (inv.items || []).map(i => ({
      name: i.name,
      qty: i.quantity,
      price: i.isBonus ? 0 : num(i.price),
      subtotal: i.isBonus ? 0 : num(i.price) * num(i.quantity),
      isBonus: !!i.isBonus,
    }));
    entries.push({
      id: inv.id, date: inv.date, ref: inv.id, desc: 'Sales Invoice',
      debit: num(inv.total), credit: 0, lineItems: itemLines,
      deliveryBilled: num(inv.deliveryBilled),
      timestamp: new Date(inv.date).getTime() + AT_INVOICE,
      group: inv.id, slot: SLOT_MAIN,
    });
    if (num(inv.receivedAmount) > 0) {
      entries.push({
        id: `${inv.id}-PAY`, date: inv.date, ref: inv.id, desc: 'Payment (On Invoice)',
        debit: 0, credit: num(inv.receivedAmount),
        timestamp: new Date(inv.date).getTime() + AT_INVOICE,
        group: inv.id, slot: SLOT_ON_INVOICE_PAYMENT,
      });
    }
  });

  invoices.filter(o => o.customerId === customerId && o.status === 'CreditNote').forEach(cn => {
    const cnLines = (cn.items || []).map(i => ({
      name: i.name, qty: i.quantity, price: num(i.price),
      subtotal: num(i.price) * num(i.quantity), isBonus: false,
    }));
    entries.push({
      id: cn.id, date: cn.date,
      ref: cn.originalInvoiceId ? `Ref: ${cn.originalInvoiceId}` : cn.id,
      desc: `Credit Note / Sales Return${cn.reason ? ` — ${cn.reason}` : ''}`,
      debit: 0, credit: num(cn.total), lineItems: cnLines, isCreditNote: true,
      timestamp: new Date(cn.date).getTime() + AT_CREDIT_NOTE,
      group: cn.id, slot: SLOT_MAIN,
    });
  });

  payments.filter(p => p.customerId === customerId).forEach(pay => {
    const payDiscount = num(pay.discount);
    const payDesc = (pay.note || 'Payment Received')
      + (payDiscount > 0 ? ` + Discount Rs.${payDiscount.toLocaleString('en-US')}` : '');
    entries.push({
      id: pay.id, date: pay.date, ref: pay.id, desc: payDesc,
      debit: 0, credit: num(pay.amount) + payDiscount, discount: payDiscount,
      timestamp: new Date(pay.date).getTime() + AT_PAYMENT,
      group: pay.id, slot: SLOT_MAIN,
    });
  });

  entries.sort((a, b) =>
    a.timestamp - b.timestamp
    || String(a.group).localeCompare(String(b.group))
    || a.slot - b.slot);

  let runningBal = openingBal;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = entries.map(entry => {
    runningBal += entry.debit;
    runningBal -= entry.credit;
    totalDebit += entry.debit;
    totalCredit += entry.credit;
    return { ...entry, balance: runningBal };
  });

  return {
    id: customer.id, customerName: customer.name, phone: customer.phone,
    openingBal, rows, totalDebit, totalCredit, closingBal: runningBal,
  };
};

export const customerBalance = (customerId, data) => {
  const ledger = buildCustomerLedger(customerId, data);
  return ledger ? ledger.closingBal : 0;
};

// ── Payment status ──────────────────────────────────────────────────────────
//
// paymentStatus was a field set by hand — the "mark paid" button wrote 'Paid', deleting a
// payment wrote 'Pending' — and nothing kept it true afterwards. Record a receipt against
// the customer and the invoice still claimed 'Pending', on screen and on the printed
// document. Analytics filtered on it too, so a stale flag skewed a report.
//
// It cannot be read off the payment records directly, because a payment belongs to the
// CUSTOMER and carries no invoice id. This business bills on account: the customer runs a
// balance and pays it down. So credits are applied OLDEST INVOICE FIRST, which is both how
// wholesale settlement is normally understood and the only rule that needs no new data.
//
// Consequences worth knowing:
//   • Cash taken on an invoice settles THAT invoice first — it was collected against it.
//   • Everything else (later receipts, credit notes) flows down the queue from the oldest
//     unpaid invoice.
//   • Back-dating an invoice can therefore change a newer invoice's status, because the
//     older one now absorbs credit first. That is correct, and it is also why the status is
//     derived rather than stored: a stored flag would simply be wrong afterwards.

export const PAID = 'Paid';
export const PARTIAL = 'Partial';
export const PENDING = 'Pending';

// Returns Map<invoiceId, amount settled>.
export const allocateCredits = (customerId, { invoices = [], payments = [] } = {}) => {
  const billed = invoices
    .filter(o => o.customerId === customerId && o.status === 'Billed')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  const settled = new Map();

  // Cash taken at billing time belongs to its own invoice, not to the queue.
  let pool = 0;
  billed.forEach(inv => {
    const onInvoice = Math.min(num(inv.receivedAmount), num(inv.total));
    settled.set(inv.id, onInvoice);
    // Overpayment on one invoice is still the customer's money; let it flow onward.
    pool += Math.max(0, num(inv.receivedAmount) - num(inv.total));
  });

  pool += payments
    .filter(p => p.customerId === customerId)
    .reduce((sum, p) => sum + num(p.amount) + num(p.discount), 0);

  pool += invoices
    .filter(o => o.customerId === customerId && o.status === 'CreditNote')
    .reduce((sum, cn) => sum + num(cn.total), 0);

  for (const inv of billed) {
    if (pool <= 0) break;
    const owed = num(inv.total) - (settled.get(inv.id) || 0);
    if (owed <= 0) continue;
    const applied = Math.min(owed, pool);
    settled.set(inv.id, (settled.get(inv.id) || 0) + applied);
    pool -= applied;
  }

  return settled;
};

export const statusFromSettled = (total, settledAmount) => {
  const owed = num(total);
  const paid = num(settledAmount);
  // Tolerate rounding: a rupee short is paid, not partial.
  if (paid >= owed - 0.5) return PAID;
  if (paid > 0) return PARTIAL;
  return PENDING;
};

// Convenience for a screen holding one invoice.
export const invoicePaymentStatus = (invoice, data) => {
  if (!invoice || invoice.status !== 'Billed') return null;
  const settled = allocateCredits(invoice.customerId, data);
  return statusFromSettled(invoice.total, settled.get(invoice.id) || 0);
};
