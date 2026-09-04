// One box for "what is Al Shaheer's balance", "what was on 8475", "who buys Antox".
//
// Each of those used to mean knowing which tab to open first. The matching is
// services/search/globalSearch.js — numbers matched bare because nobody types INV-, phones
// compared as digits, words matched at word boundaries.
//
// Every result leads somewhere, and a customer always leads to their ledger: brief §14 asks
// that clicking a customer anywhere does the same thing, and it is the answer to the
// question that brings someone to a search box in the first place.
import { useState, useMemo, useContext, useRef, useEffect } from 'react';
import { Search, Users, ReceiptText, Wallet, Package, Building2, ArrowRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import { globalSearch, printDocTypeFor } from '../../services/search/globalSearch';
import { formatDateDisp } from '../../helpers';

const KIND_ICON = {
  customer: Users, invoice: ReceiptText, payment: Wallet, product: Package, company: Building2,
};
const KIND_TINT = {
  customer: 'bg-indigo-50 text-indigo-600',
  invoice: 'bg-amber-50 text-amber-600',
  payment: 'bg-emerald-50 text-emerald-600',
  product: 'bg-sky-50 text-sky-600',
  company: 'bg-slate-100 text-slate-600',
};

export const GlobalSearchModal = ({ onClose }) => {
const {
  customers, invoices, payments, products, companies,
  isAdmin, hasPermission, getCustomerBalance,
  setSelectedLedgerId, setShowLedgerModal, setPrintConfig,
  setEditingProduct, setShowProductModal, setActiveTab,
} = useContext(AppContext);

const [query, setQuery] = useState('');
const inputRef = useRef(null);
useEffect(() => { inputRef.current?.focus(); }, []);

const results = useMemo(
  () => globalSearch(query, { customers, invoices, payments, products, companies }),
  [query, customers, invoices, payments, products, companies]);

const canEditProducts = isAdmin || (hasPermission && hasPermission('addEditProducts'));

const open = (hit) => {
  switch (hit.kind) {
    case 'customer':
      setSelectedLedgerId(hit.entity.id); setShowLedgerModal(true); break;
    case 'payment':
      // A receipt belongs to a customer, and the ledger is where it makes sense.
      setSelectedLedgerId(hit.entity.customerId); setShowLedgerModal(true); break;
    case 'invoice':
      setPrintConfig({ docType: printDocTypeFor(hit.entity), format: 'a4', data: hit.entity }); break;
    case 'product':
      if (!canEditProducts) { setActiveTab('products'); break; }
      setEditingProduct(hit.entity); setShowProductModal(true); break;
    case 'company':
      setActiveTab('products'); break;
    default: break;
  }
  onClose();
};

const money = (n) => `Rs.${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

return (
<ModalWrapper title="Search everything" onClose={onClose} maxWidth="max-w-2xl">
<div className="space-y-3 pb-10">

  <div className="relative">
    <Search size={16} className="absolute left-3 top-3.5 text-slate-400 pointer-events-none"/>
    <input
      ref={inputRef}
      type="search"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Customer, phone, invoice no., receipt no., product, brand…"
      aria-label="Search customers, invoices, receipts, products and brands"
      className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
    />
  </div>

  {query.trim().length < 2 && (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
      <p className="text-sm font-bold text-slate-500">Type at least two characters.</p>
      <p className="text-[11px] text-slate-400 mt-2">
        Numbers work bare — <span className="font-mono font-bold">8475</span> finds INV-8475.
        Phone numbers match however they are written.
      </p>
    </div>
  )}

  {query.trim().length >= 2 && results.groups.length === 0 && (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
      <p className="text-sm font-bold text-slate-500">Nothing matches “{query.trim()}”.</p>
    </div>
  )}

  {results.groups.map(g => {
    const Icon = KIND_ICON[g.kind];
    return (
      <div key={g.kind} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{g.label}</span>
          {g.more > 0 && <span className="text-[10px] text-slate-400 font-bold">+{g.more} more — narrow the search</span>}
        </div>
        <div className="divide-y divide-slate-100">
          {g.results.map(hit => (
            <button
              key={`${hit.kind}-${hit.id}`}
              onClick={() => open(hit)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
            >
              <span className={`p-2 rounded-lg shrink-0 ${KIND_TINT[hit.kind]}`}><Icon size={14}/></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-800 truncate">{hit.title}</span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {hit.date ? `${formatDateDisp(hit.date)}${hit.subtitle ? ' · ' : ''}` : ''}{hit.subtitle}
                </span>
              </span>
              <span className="text-right shrink-0">
                {hit.kind === 'customer' ? (() => {
                  const bal = getCustomerBalance ? getCustomerBalance(hit.entity.id) : 0;
                  return <span className={`block text-xs font-black ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(bal)}</span>;
                })() : hit.amount !== undefined ? (
                  <span className="block text-xs font-black text-slate-700">{money(hit.amount)}</span>
                ) : null}
              </span>
              <ArrowRight size={13} className="text-slate-300 shrink-0"/>
            </button>
          ))}
        </div>
      </div>
    );
  })}
</div>
</ModalWrapper>
);
};
