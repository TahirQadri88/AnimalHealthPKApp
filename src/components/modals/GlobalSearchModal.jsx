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
import { useSyncStatus } from '../../hooks/useSyncStatus';

const KIND_ICON = {
  customer: Users, invoice: ReceiptText, payment: Wallet, product: Package, company: Building2,
};
const KIND_TINT = {
  customer: 'bg-kt-blue/10 text-kt-blue',
  invoice: 'bg-kt-amber/10 text-kt-amber',
  payment: 'bg-kt-green/10 text-kt-green',
  product: 'bg-kt-blue/10 text-kt-blue',
  company: 'bg-kt-raised text-kt-sub',
};

export const GlobalSearchModal = ({ onClose }) => {
const {
  customers, invoices, payments, products, companies,
  isAdmin, hasPermission, getCustomerBalance,
  setSelectedLedgerId, setShowLedgerModal, setPrintConfig,
  setEditingProduct, setShowProductModal, setActiveTab,
} = useContext(AppContext);

const [query, setQuery] = useState('');
// "Nothing matches" and "nothing matches in what this device has saved" are different
// answers, and a person reading the first as the second concludes a customer does not
// exist — or worse, that they owe nothing.
const { state: syncState } = useSyncStatus();
const offline = syncState === 'offline' || syncState === 'stale';
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
    <Search size={16} className="absolute left-3 top-3.5 text-kt-muted pointer-events-none"/>
    <input
      ref={inputRef}
      type="search"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Customer, phone, invoice no., receipt no., product, brand…"
      aria-label="Search customers, invoices, receipts, products and brands"
      className="w-full pl-10 pr-3 py-3 bg-white border border-kt-line rounded-xl text-sm font-semibold outline-none focus:border-kt-blue/30 focus:ring-2 focus:ring-kt-blue/30"
    />
  </div>

  {/* Said before the search rather than only after one fails. Someone searching offline
      should know the set is partial while they are still typing. */}
  {offline && (
    <p className="text-xs font-medium text-kt-amber bg-kt-amber/10 border border-kt-amber/30 rounded-lg px-3 py-2">
      Searching data saved on this device. Anything added elsewhere since your last connection is not here.
    </p>
  )}

  {query.trim().length < 2 && (
    <div className="bg-white border border-kt-line rounded-xl p-6 text-center">
      <p className="text-sm font-medium text-kt-sub">Type at least two characters.</p>
      <p className="text-xs text-kt-muted mt-2">
        Numbers work bare — <span className="font-mono font-medium">8475</span> finds INV-8475.
        Phone numbers match however they are written.
      </p>
    </div>
  )}

  {query.trim().length >= 2 && results.groups.length === 0 && (
    <div className={`rounded-xl p-6 text-center border ${offline ? 'bg-kt-amber/10 border-kt-amber/30' : 'bg-white border-kt-line'}`}>
      <p className={`text-sm font-medium ${offline ? 'text-kt-amber' : 'text-kt-sub'}`}>
        {offline ? 'Not available offline' : `Nothing matches “${query.trim()}”.`}
      </p>
      {offline && (
        <p className="text-xs text-kt-amber mt-2 leading-relaxed">
          Nothing saved on this device matches “{query.trim()}”. That is not the same as it not
          existing — connect to the internet to search everything.
        </p>
      )}
    </div>
  )}

  {results.groups.map(g => {
    const Icon = KIND_ICON[g.kind];
    return (
      <div key={g.kind} className="bg-white rounded-xl border border-kt-line overflow-hidden">
        <div className="bg-kt-raised border-b border-kt-line px-3 py-2 flex justify-between items-center">
          <span className="text-xs font-medium text-kt-sub">{g.label}</span>
          {g.more > 0 && <span className="text-xs text-kt-muted font-medium">+{g.more} more — narrow the search</span>}
        </div>
        <div className="divide-y divide-kt-line">
          {g.results.map(hit => (
            <button
              key={`${hit.kind}-${hit.id}`}
              onClick={() => open(hit)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-kt-raised transition-colors"
            >
              <span className={`p-2 rounded-lg shrink-0 ${KIND_TINT[hit.kind]}`}><Icon size={14}/></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-kt-ink truncate">{hit.title}</span>
                <span className="block text-xs text-kt-muted truncate">
                  {hit.date ? `${formatDateDisp(hit.date)}${hit.subtitle ? ' · ' : ''}` : ''}{hit.subtitle}
                </span>
              </span>
              <span className="text-right shrink-0">
                {hit.kind === 'customer' ? (() => {
                  const bal = getCustomerBalance ? getCustomerBalance(hit.entity.id) : 0;
                  return <span className={`block text-xs font-semibold ${bal > 0 ? 'text-kt-red' : 'text-kt-green'}`}>{money(bal)}</span>;
                })() : hit.amount !== undefined ? (
                  <span className="block text-xs font-semibold text-kt-ink">{money(hit.amount)}</span>
                ) : null}
              </span>
              <ArrowRight size={13} className="text-kt-muted shrink-0"/>
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
