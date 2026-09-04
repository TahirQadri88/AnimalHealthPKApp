// What a customer card should say without anybody opening anything.
//
// Brief §14: name, outstanding, last invoice, last payment, last transaction. The card had
// the first two. The rest meant opening the ledger to answer "have they bought lately" and
// "when did they last pay" — the two questions actually asked before ringing someone.
//
// "Last payment" counts cash taken at the counter when the bill was raised, not only the
// receipts collection. On some days that is most of the money that comes in, and a card
// that ignored it would tell you a customer who paid in full yesterday had not paid in
// months. Same reasoning as the Collections view.
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Dates are date-only strings, so same-day records tie; the higher document number is the
// later one.
const latest = (rows) => rows.slice().sort((a, b) =>
  String(b.date || '').localeCompare(String(a.date || ''))
  || String(b.id || '').localeCompare(String(a.id || '')))[0] || null;

export const buildCustomerCard = (customerId, { invoices = [], payments = [], asOf } = {}) => {
  const mine = invoices.filter(o => o.customerId === customerId);
  const billed = mine.filter(o => o.status === 'Billed');

  const lastInv = latest(billed);
  const lastInvoice = lastInv
    ? { id: lastInv.id, date: lastInv.date, amount: num(lastInv.total) }
    : null;

  // Every credit the customer has given us, from either direction.
  const credits = [
    ...billed.filter(o => num(o.receivedAmount) > 0).map(o => ({
      id: `${o.id}-PAY`, ref: o.id, date: o.date, amount: num(o.receivedAmount), atBilling: true,
    })),
    ...payments.filter(p => p.customerId === customerId).map(p => ({
      id: p.id, ref: p.id, date: p.date, amount: num(p.amount), atBilling: false, note: p.note || '',
    })),
  ];
  const lastPay = latest(credits);
  const lastPayment = lastPay
    ? { id: lastPay.ref, date: lastPay.date, amount: lastPay.amount, atBilling: lastPay.atBilling }
    : null;

  const dates = [lastInvoice?.date, lastPayment?.date].filter(Boolean);
  const lastActivityDate = dates.length ? dates.sort().reverse()[0] : null;

  let daysSinceActivity = null;
  if (lastActivityDate) {
    const then = new Date(lastActivityDate);
    const now = asOf ? new Date(asOf) : new Date();
    if (!Number.isNaN(then.getTime()) && !Number.isNaN(now.getTime())) {
      daysSinceActivity = Math.max(0, Math.floor((now - then) / 86400000));
    }
  }

  return {
    lastInvoice, lastPayment, lastActivityDate, daysSinceActivity,
    invoiceCount: billed.length,
    paymentCount: credits.length,
    // A customer who has never bought anything is not the same as one who is up to date,
    // and the card should not imply otherwise.
    isNew: billed.length === 0 && credits.length === 0,
  };
};

// A reminder that says what is owed, in the words this business uses.
export const balanceReminderText = (customer, balance, appName) =>
  `Assalam o Alaikum ${customer?.name || ''},\n\n`
  + `Your outstanding balance with ${appName} is *Rs. ${Math.round(Number(balance) || 0).toLocaleString('en-US')}*.\n\n`
  + `Kindly process the payment at your earliest convenience.\n\nJazakAllah Khair`;

// wa.me wants a bare international number: no plus, no leading zero, 92 for Pakistan.
export const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('92')) return d;
  return `92${d.replace(/^0/, '')}`;
};
