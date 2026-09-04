// One search box across everything the business is asked about by name or number.
//
// The questions this exists to answer are the ones actually asked on the phone: "what is
// Al Shaheer's balance", "what was on 8475", "did receipt 12 go through", "who buys Antox".
// Each of those previously meant knowing which tab to open first.
//
// Three matching rules, all of them earned by how people type:
//
//   • Numbers are matched bare. Nobody says "INV-8475"; they say "8475". A query that is
//     all digits matches the numeric tail of a document id as well as the whole id.
//   • Phone numbers are compared as digits only, so 0300-1234567, 03001234567 and
//     +923001234567 are the same number. A leading 0 and a 92 country code are stripped
//     from both sides before comparing.
//   • Words are matched at word boundaries, not just anywhere: "shah" finds "Al Shaheer"
//     ahead of "Bakhshah", because a match at the start of a word is what a person means.
//
// Ranking is by how exact the match is, then by recency for dated records — a search for a
// customer's name should surface this month's invoice above one from last year.
const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

// 0300-1234567, 03001234567 and +92 300 1234567 are one number.
export const normalisePhone = (v) => {
  let d = digitsOnly(v);
  if (d.startsWith('92')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
};

export const EXACT = 100;
export const PREFIX = 60;
export const WORD = 40;
export const CONTAINS = 20;

/** How well `text` answers `query`, 0 for not at all. */
export const scoreText = (text, query) => {
  const t = String(text || '').toLowerCase().trim();
  const q = String(query || '').toLowerCase().trim();
  if (!t || !q) return 0;
  if (t === q) return EXACT;
  if (t.startsWith(q)) return PREFIX;
  // A match at the start of any word beats one in the middle of one.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return WORD;
  if (t.includes(q)) return CONTAINS;
  return 0;
};

/** Document ids: INV-8475 is found by "8475", "inv-8475" or "INV8475". */
export const scoreDocId = (id, query) => {
  const q = String(query || '').trim();
  if (!q) return 0;
  // The text score is a floor, not an answer: "8475" already sits at a word boundary in
  // "INV-8475" because the hyphen is one, so returning it early scored a dead-on invoice
  // number as a middling partial match and filed it under the wrong group.
  let best = scoreText(id, q);
  const idDigits = digitsOnly(id);
  const qDigits = digitsOnly(q);
  // Only when the query is all digits — otherwise "b12" would match every id containing 12.
  if (qDigits && /^\d+$/.test(q)) {
    if (idDigits === qDigits) best = Math.max(best, EXACT);
    else if (idDigits.startsWith(qDigits)) best = Math.max(best, PREFIX);
    else if (idDigits.endsWith(qDigits)) best = Math.max(best, WORD);
  }
  // INV8475 for INV-8475.
  const squash = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (squash(id) === squash(q)) best = Math.max(best, EXACT);
  // REC-12 for REC-0012. Document numbers are zero-padded on paper and nobody types the
  // padding, so when the query carries the same prefix the numbers are compared as numbers.
  const parts = (v) => String(v).trim().match(/^([A-Za-z]+)[-\s]?(\d+)$/);
  const a = parts(id);
  const b = parts(q);
  if (a && b && a[1].toLowerCase() === b[1].toLowerCase() && Number(a[2]) === Number(b[2])) {
    best = Math.max(best, EXACT);
  }
  return best;
};

export const scorePhone = (phone, query) => {
  const p = normalisePhone(phone);
  const q = normalisePhone(query);
  // Three digits is not a phone number, it is a coincidence.
  if (!p || q.length < 3) return 0;
  if (p === q) return EXACT;
  if (p.startsWith(q)) return PREFIX;
  if (p.includes(q)) return CONTAINS;
  return 0;
};

// The document type PrintView needs for an invoice record, which depends on its status —
// the same mapping the billing list uses on its own row buttons.
export const printDocTypeFor = (invoice) => {
  if (invoice?.status === 'Estimate' || invoice?.status === 'Booked') return 'estimate';
  if (invoice?.status === 'CreditNote') return 'creditnote';
  return 'invoice';
};

const KIND_LABEL = {
  customer: 'Customers',
  invoice: 'Invoices & credit notes',
  payment: 'Receipts',
  product: 'Products',
  company: 'Brands',
};

export const globalSearch = (query, {
  customers = [], invoices = [], payments = [], products = [], companies = [],
} = {}, { perGroup = 6 } = {}) => {
  const q = String(query || '').trim();
  // One character matches half the database and helps nobody.
  if (q.length < 2) return { query: q, groups: [], total: 0 };

  const hits = [];
  const push = (kind, score, result) => { if (score > 0) hits.push({ kind, score, ...result }); };

  customers.forEach(c => {
    const score = Math.max(scoreText(c.name, q), scorePhone(c.phone, q));
    push('customer', score, {
      id: String(c.id), entity: c,
      title: c.name || 'Unnamed customer',
      subtitle: [c.phone, c.city, c.area].filter(Boolean).join(' · '),
    });
  });

  invoices.forEach(o => {
    const score = Math.max(scoreDocId(o.id, q), scoreText(o.customerName, q) - 5);
    push('invoice', score, {
      id: String(o.id), entity: o, date: o.date,
      title: o.id,
      subtitle: [o.customerName, o.status].filter(Boolean).join(' · '),
      amount: Number(o.total) || 0,
    });
  });

  payments.forEach(p => {
    const score = Math.max(scoreDocId(p.id, q), scoreText(p.note, q) - 10);
    push('payment', score, {
      id: String(p.id), entity: p, date: p.date,
      title: p.id,
      subtitle: [customers.find(c => c.id === p.customerId)?.name, p.note].filter(Boolean).join(' · '),
      amount: Number(p.amount) || 0,
    });
  });

  products.forEach(p => {
    const score = Math.max(scoreText(p.name, q), scoreText(p.company, q) - 10);
    push('product', score, {
      id: String(p.id), entity: p,
      title: p.name || 'Unnamed product',
      subtitle: [p.company, p.unit].filter(Boolean).join(' · '),
      amount: Number(p.price) || 0,
    });
  });

  companies.forEach(c => {
    push('company', scoreText(c.name, q), {
      id: String(c.id), entity: c,
      title: c.name,
      subtitle: `${products.filter(p => String(p.companyId) === String(c.id)).length} products`,
    });
  });

  const groups = Object.keys(KIND_LABEL).map(kind => {
    const results = hits
      .filter(h => h.kind === kind)
      // Recency second, so a name search surfaces this month's invoice above last year's.
      // Dates here are date-only, so two bills on one day tie — and for a dated record the
      // higher document number is the later one, which is not alphabetical order.
      .sort((a, b) => b.score - a.score
        || String(b.date || '').localeCompare(String(a.date || ''))
        || (a.date || b.date
          ? String(b.title).localeCompare(String(a.title))
          : String(a.title).localeCompare(String(b.title))))
      .slice(0, perGroup);
    return { kind, label: KIND_LABEL[kind], results, more: hits.filter(h => h.kind === kind).length - results.length };
  }).filter(g => g.results.length > 0);

  // The strongest match overall goes first, so an invoice number does not sit under a
  // customer whose name happened to contain the same digits.
  groups.sort((a, b) => b.results[0].score - a.results[0].score);

  return { query: q, groups, total: groups.reduce((s, g) => s + g.results.length + g.more, 0) };
};
