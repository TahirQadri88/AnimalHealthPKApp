// Product and customer search for the billing form.
//
// Every word typed must appear in the product's name or its company, so "tylo 20" finds
// "Tylosin 20% Inj" and "antox ilyas" finds Antox by its maker. A query that matched before
// (the whole text inside the name) still matches: this only ever finds more.
// Results are ranked (start of name, then start of a word, then anywhere) and capped, so a
// one-letter query no longer renders hundreds of rows on a phone.
import { scoreText } from '../services/search/globalSearch';

const words = (q) => String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);

export const rankProducts = (products = [], query, { companyName = () => '', limit = 30 } = {}) => {
  const ws = words(query);
  if (!ws.length) return { items: [], total: 0 };
  const q = ws.join(' ');
  const hits = [];
  products.forEach((p, order) => {
    if (!p || !p.available || p.archived) return;
    const name = String(p.name || '').toLowerCase();
    const company = String(companyName(p.companyId) || '').toLowerCase();
    if (!ws.every(w => name.includes(w) || company.includes(w))) return;
    const score = Math.max(scoreText(name, q), ...ws.map(w => scoreText(name, w) / 2), scoreText(company, q) / 4);
    hits.push({ p, score, order });
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return { items: hits.slice(0, limit).map(h => h.p), total: hits.length };
};

export const customerMatches = (customers = [], query, limit = 50) => {
  const ws = words(query);
  const all = ws.length
    ? customers.filter(c => { const n = String(c?.name || '').toLowerCase(); return ws.every(w => n.includes(w)); })
    : customers;
  return { items: all.slice(0, limit), total: all.length };
};
