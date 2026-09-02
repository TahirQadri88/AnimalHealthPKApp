import { useState, useContext } from 'react';
import { Users, Plus, Search, Edit, Trash2, Lock, Download, Calendar } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { formatDateDisp, checkDateFilter, exportToCSV } from '../../helpers';
import { loginSlug } from '../../lib/loginNames';

export const UserManagementView = () => {
const { migrateUsersToAuth, repairLoginIndex,
        isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [userDateFilter, setUserDateFilter] = useState('This Month');
const [userSearch, setUserSearch] = useState('');
const [migrating, setMigrating] = useState(false);
const [migrateResult, setMigrateResult] = useState(null);
const legacyUsers = appUsers.filter(u => !u.authUid);
const runMigration = async () => {
  setMigrating(true); setMigrateResult(null);
  try {
    const res = await migrateUsersToAuth();
    setMigrateResult(res);
    if (res.done > 0 && res.failed.length === 0) showToast(`${res.done} account(s) moved to Firebase Auth`);
    else if (res.failed.length > 0) showToast(`${res.done} moved, ${res.failed.length} need attention`, 'error');
  } finally { setMigrating(false); }
};
return (
<div className="flex-1 overflow-y-auto p-4 pb-24">
<div className="flex justify-between items-center mb-4">
<div>
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Team Management</h3>
<p className="text-[10px] text-slate-400 mt-0.5">{appUsers.length} users registered</p>
</div>
<button onClick={() => { setEditingUser(null); setShowUserModal(true); }} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 hover:bg-indigo-700 transition-colors"><Plus size={14}/> Add User</button>
</div>
<div className="relative mb-3"><Search className="absolute left-3 top-2.5 text-slate-400" size={14}/><input placeholder="Search users..." className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold outline-none text-sm shadow-sm focus:border-indigo-400" value={userSearch} onChange={e=>setUserSearch(e.target.value)} /></div>
<div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm mb-4 w-fit">
<Calendar size={13} className="text-indigo-500"/>
<select value={userDateFilter} onChange={e=>setUserDateFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
<option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option>
</select>
</div>
<div className="space-y-3">
{appUsers.filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.role.toLowerCase().includes(userSearch.toLowerCase())).map(u => {
const userInvoices = invoices.filter(inv => inv.salespersonId === u.id && inv.status === 'Billed' && checkDateFilter(inv.date, userDateFilter));
const totalSales = userInvoices.reduce((sum, inv) => sum + inv.total, 0);
const totalProfit = userInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + ((item.price - item.costPrice) * item.quantity), 0), 0);
const avgOrder = userInvoices.length > 0 ? Math.round(totalSales / userInvoices.length) : 0;
return (
<div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-start mb-3">
<div className="min-w-0 flex-1">
<h4 className="font-bold text-slate-800 text-base">{u.name}{u.active === false && <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 align-middle">Disabled</span>}</h4>
<span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{u.role === 'admin' ? 'Administrator' : 'Sales Staff'}</span>
{u.role === 'staff' && (() => {
  const p = u.permissions || {};
  const grants = [
    p.viewAllInvoices  && 'All Invoices',
    p.viewDashboard    && 'Dashboard',
    p.viewCustomers    && 'Customers',
    p.receivePayments  && 'Receipts',
    p.collectOnBill    && 'Collect on Bill',
    p.editOwnInvoices  && 'Edit Own',
    p.issueInvoices    && 'Issue Docs',
    p.salesReturns     && 'Returns',
    p.viewLedger       && 'Ledger',
    p.addCustomers     && 'Add Customers',
    p.addEditProducts  && 'Add Products',
  ].filter(Boolean);
  return grants.length > 0
    ? <div className="flex flex-wrap gap-1 mt-1.5">{grants.map(g => <span key={g} className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{g}</span>)}</div>
    : <p className="text-[9px] text-slate-400 italic mt-1">Own invoices only</p>;
})()}
</div>
<div className="flex gap-1.5">
<button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button>
<button onClick={async () => { if(u.id === currentUser.id) return showToast("Cannot delete yourself","error");
  if (u.role === 'admin' && appUsers.filter(x => x.role === 'admin').length <= 1) return showToast("This is the only admin — promote someone else first","error"); if(await showConfirm(`Permanently delete user ${u.name}?`)) {
    await deleteFromFirebase('app_users', u.id);
    // The Firebase Auth account cannot be removed from the browser, so its password still
    // works. Deleting the role mirror is what actually revokes access — leave it and the
    // "deleted" user keeps full rights once the strict rules are live.
    if (u.authUid) await deleteFromFirebase('userRoles', u.authUid);
    await deleteFromFirebase('loginIndex', loginSlug(u.loginName || u.name));
  } }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
</div>
</div>
<div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Orders</p><p className="font-extrabold text-slate-700 text-lg">{userInvoices.length}</p></div>
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Revenue</p><p className="font-extrabold text-emerald-600 text-sm">Rs.{totalSales.toLocaleString('en-US')}</p></div>
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">GP</p><p className={`font-extrabold text-sm ${totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>Rs.{totalProfit.toLocaleString('en-US')}</p></div>
</div>
{userInvoices.length > 0 && (
<div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500">
<span>Avg order: <span className="font-bold text-slate-700">Rs.{avgOrder.toLocaleString('en-US')}</span></span>
<span>Last sale: <span className="font-bold text-slate-700">{formatDateDisp(userInvoices.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date)}</span></span>
</div>
)}
</div>
);
})}
</div>
<div className="mt-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Lock size={14} className={legacyUsers.length ? "text-rose-600" : "text-emerald-600"}/> Login Security</h3>
{legacyUsers.length === 0 ? (
  <>
    <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3 leading-relaxed mb-2">
      All {appUsers.length} account(s) use Firebase Authentication. No passwords are stored in the database.
    </p>
    <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
      <strong>Repair tool.</strong> Sign-in looks a username up here before it can read anything
      else. If someone is told &ldquo;Invalid Credentials&rdquo; with a password you know is
      right, rebuild this first — it is far more likely than a wrong password. Safe to run any
      time; it rewrites every entry.
    </p>
    <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
      Note: renaming a user does not change the name they log in with. The login name is fixed
      when the account is created.
    </p>
    <button onClick={async () => { const n = await repairLoginIndex(); showToast(`Login lookup rebuilt for ${n} account(s)`); }}
      className="w-full bg-slate-800 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-slate-700 transition-colors">
      Rebuild login lookup
    </button>
  </>
) : (
  <>
    <p className="text-[11px] font-semibold text-slate-600 leading-relaxed mb-2">
      <strong className="text-rose-600">{legacyUsers.length} of {appUsers.length} account(s)</strong> still keep their
      password in the database as plain text, where anyone who can read the database can read it.
      Moving them to Firebase Authentication stores only a hash, handled by Google.
    </p>
    <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
      Nobody is signed out and passwords do not change — everyone keeps logging in exactly as they do now.
      Enable <strong>Email/Password</strong> under Authentication → Sign-in method in the Firebase console first,
      and take a backup before running this.
    </p>
    <button onClick={runMigration} disabled={migrating}
      className="w-full bg-rose-600 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors">
      {migrating ? 'Moving accounts…' : `Move ${legacyUsers.length} account(s) to Firebase Auth`}
    </button>
  </>
)}
{migrateResult && (
  <div className="mt-3 space-y-1.5">
    {migrateResult.done > 0 && <p className="text-[11px] font-bold text-emerald-700">✓ {migrateResult.done} account(s) moved.</p>}
    {migrateResult.failed.map((f, i) => (
      <p key={i} className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 leading-relaxed">
        <strong>{f.name}:</strong> {f.why}
      </p>
    ))}
  </div>
)}
</div>

<div className="mt-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-indigo-600"/> Export Users</h3>
<button onClick={() => { // Never export credentials. This CSV lands in Downloads, gets mailed around and
              // sits in backups; a password column here is a leak with no legitimate use.
              const data = appUsers.map(u => ({ ID: u.id, Name: u.name, Role: u.role })); exportToCSV(data, 'Users_Export.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export Users CSV</button>
</div>
</div>
);
};
