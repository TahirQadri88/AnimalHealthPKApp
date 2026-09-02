import { useState, useContext } from 'react';
import { Calendar, Download, Search, Tag } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { EXPENSE_GROUPS, EXPENSE_GROUP_COLORS } from '../../lib/constants';
import { getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV } from '../../helpers';
import SearchableSelect from '../SearchableSelect';

export const ExpensesView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm, showPrompt, voidRecord, logSave } = useContext(AppContext);
const [date, setDate] = useState(getLocalDateStr());
const [amount, setAmount] = useState('');
const [category, setCategory] = useState(expenseCategories[0]?.name || '');
const [note, setNote] = useState('');
const [editingExpense, setEditingExpense] = useState(null);
const [expFilter, setExpFilter] = useState('This Month');
const [groupFilter, setGroupFilter] = useState('All');
const [expSearch, setExpSearch] = useState('');
const saveExpense = async () => {
if(!amount || !category) return showToast("Amount & Category required", "error");
if (editingExpense) {
const updatedExp = {...editingExpense, date, category, amount: Number(amount), note};
await saveToFirebase('expenses', editingExpense.id, updatedExp);
await logSave('expenses', editingExpense, updatedExp, category);
setEditingExpense(null);
showToast("Expense Updated");
} else {
const newExp = {id: Date.now(), date, category, amount: Number(amount), note};
await saveToFirebase('expenses', newExp.id, newExp);
await logSave('expenses', null, newExp, category);
showToast("Expense Recorded");
}
setAmount(''); setNote(''); setDate(getLocalDateStr()); setCategory(expenseCategories[0]?.name || '');
};
const startEdit = (exp) => { setEditingExpense(exp); setDate(exp.date); setAmount(String(exp.amount)); setCategory(exp.category); setNote(exp.note || ''); };
const cancelEdit = () => { setEditingExpense(null); setAmount(''); setNote(''); setDate(getLocalDateStr()); setCategory(expenseCategories[0]?.name || ''); };
const filteredExpenses = expenses.filter(e => checkDateFilter(e.date, expFilter)).filter(e => { if (groupFilter === 'All') return true; const cat = expenseCategories.find(c => c.name === e.category); return (cat?.group || 'Other') === groupFilter; }).filter(e => !expSearch || e.category.toLowerCase().includes(expSearch.toLowerCase()) || (e.note||'').toLowerCase().includes(expSearch.toLowerCase())).slice().reverse();
const filteredTotal = filteredExpenses.reduce((s,e)=>s+Number(e.amount),0);
return (
<div className="flex-1 overflow-y-auto p-4 pb-24">
<form onSubmit={e => { e.preventDefault(); saveExpense(); }} className={`bg-white p-4 rounded-2xl border shadow-sm mb-4 ${editingExpense ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
<div className="flex justify-between items-center mb-3">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{editingExpense ? '– Edit Expense' : 'Record New Expense'}</h3>
<div className="flex gap-2">
{editingExpense && <button type="button" onClick={cancelEdit} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Cancel</button>}
<button type="button" onClick={() => setShowExpenseCatModal(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">Manage Labels</button>
</div>
</div>
<div className="grid grid-cols-2 gap-3 mb-3">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Date</label><input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={date} onChange={e=>setDate(e.target.value)}/></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Category</label><SearchableSelect className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={category} onChange={e=>setCategory(e.target.value)} placeholder="– Select –" options={EXPENSE_GROUPS.map(g=>({ group: g, options: expenseCategories.filter(c=>(c.group||'Other')===g).map(c=>({value:c.name,label:c.name})) })).filter(g=>g.options.length>0)} /></div>
</div>
<div className="mb-3"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Amount</label><input type="number" placeholder="0.00" className="w-full p-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-lg font-extrabold outline-none focus:border-rose-400" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
<div className="mb-4"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Short Note</label><input type="text" placeholder="e.g. Paid to Ali for DHA drop" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={note} onChange={e=>setNote(e.target.value)}/></div>
<button type="submit" className={`w-full font-bold py-3.5 rounded-xl shadow-md text-white ${editingExpense ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}>{editingExpense ? 'Update Expense' : 'Record Expense'}</button>
</form>
<div className="relative mb-2"><Search className="absolute left-3 top-2.5 text-slate-400" size={14}/><input placeholder="Search by category or note..." className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold outline-none text-sm shadow-sm focus:border-rose-400" value={expSearch} onChange={e=>setExpSearch(e.target.value)} /></div>
<div className="flex items-center gap-2 mb-3 flex-wrap">
<div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
<Calendar size={13} className="text-rose-500"/>
<select value={expFilter} onChange={e=>setExpFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
<option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option>
</select>
</div>
<div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
<Tag size={11} className="text-indigo-500"/>
<select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
<option value="All">All Groups</option>{EXPENSE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
</select>
</div>
<div className="ml-auto text-right">
<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total</p>
<p className="font-extrabold text-rose-600 text-base">Rs.{filteredTotal.toLocaleString('en-US')}</p>
</div>
</div>
<div className="space-y-2.5">
{filteredExpenses.map(exp => (
<div key={exp.id} className={`bg-white p-3.5 rounded-2xl border shadow-sm flex justify-between items-center ${editingExpense?.id === exp.id ? 'border-amber-300 ring-2 ring-amber-200' : 'border-slate-200'}`}>
<div>{(() => { const cat = expenseCategories.find(c=>c.name===exp.category); const grp = cat?.group||'Other'; return <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Tag size={12} className="text-slate-400"/> {exp.category} <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${EXPENSE_GROUP_COLORS[grp]}`}>{grp}</span></p>; })()}<p className="text-[11px] text-slate-500 font-medium mt-0.5">{formatDateDisp(exp.date)} {exp.note ? `- ${exp.note}` : ''}</p></div>
<div className="text-right ml-3">
<p className="font-extrabold text-rose-600 text-base">Rs.{exp.amount.toLocaleString('en-US')}</p>
<div className="flex gap-2 mt-1 justify-end">
<button onClick={() => startEdit(exp)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold uppercase">Edit</button>
<button onClick={async ()=>{ const reason = await showPrompt("Void this expense?\n\nIt stays on file and leaves the P&L.", { placeholder: 'e.g. entered twice' }); if(reason === null) return; await voidRecord('expenses', exp, { label: exp.category || exp.id, reason }); showToast('Expense voided'); }} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase">Void</button>
</div>
</div>
</div>
))}
{filteredExpenses.length === 0 && <div className="text-center py-8 text-slate-400 text-sm font-medium">No expenses for this period</div>}
</div>
<div className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-rose-500"/> Export Expenses</h3>
<button onClick={() => { const data = expenses.map(e => { const cat = expenseCategories.find(c=>c.name===e.category); return { ID: e.id, Date: e.date, Group: cat?.group||'Other', Category: e.category, Amount: e.amount, Note: e.note || '' }; }); exportToCSV(data, 'Expenses_Export.csv'); }} className="w-full bg-rose-50 border border-rose-100 text-rose-700 py-2.5 rounded-xl font-bold text-xs">Export All Expenses CSV</button>
</div>
</div>
);
};
