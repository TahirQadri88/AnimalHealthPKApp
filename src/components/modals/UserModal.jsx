import { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';

export const UserModal = () => {
const { editingUser, appUsers, checkDuplicate, saveToFirebase, showToast, setShowUserModal, resetUserLogin, saveUserAccount } = useContext(AppContext);
const isEdit = !!editingUser;
const [form, setForm] = useState(isEdit ? editingUser : { name: '', password: '', role: 'staff', permissions: {} });
// A migrated account keeps no password here — Firebase holds it. Asking for one would
// both block ordinary edits and write a plaintext password straight back into the
// database we just cleaned.
const onFirebaseAuth = !!form.authUid;
const [newPassword, setNewPassword] = useState('');
const [resetting, setResetting] = useState(false);
const setPermission = (key, val) => setForm(f => ({ ...f, permissions: { ...(f.permissions || {}), [key]: val } }));
const save = async () => {
if (!form.name) return showToast("Name is required", "error");
if (!onFirebaseAuth && !form.password) return showToast("Password is required", "error");
if (checkDuplicate(appUsers, form.name, form.id)) return showToast("Username already exists", "error");
// Creating a user now means creating a Firebase Auth account too, so this goes through
// one function that keeps the profile, the role mirror and the login index in step.
const res = await saveUserAccount(form, isEdit);
if (!res.ok) return showToast(res.why, "error");
showToast(isEdit ? "User Updated" : "User Added");
setShowUserModal(false);
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
const PERMS = [
  { key: 'viewAllInvoices',  label: 'View All Invoices',     desc: 'See invoices from all staff (default: own only)' },
  { key: 'viewDashboard',    label: 'Home Dashboard',        desc: 'Revenue summary & business overview' },
  { key: 'viewCustomers',    label: 'Customer List',         desc: 'Browse all customers & outstanding balances' },
  { key: 'receivePayments',  label: 'Receive Payments',      desc: 'Record new customer payments in Receipts tab' },
  { key: 'collectOnBill',    label: 'Collect on Invoice',    desc: 'Record payment received while creating an invoice' },
  { key: 'editOwnInvoices',  label: 'Edit Own Invoices',     desc: 'Edit or delete invoices they personally created' },
  { key: 'issueInvoices',    label: 'Issue / Convert Docs',  desc: 'Convert estimates to orders or finalize as invoices' },
  { key: 'salesReturns',     label: 'Sales Returns',         desc: 'Issue credit notes and process product returns' },
  { key: 'viewLedger',       label: 'Customer Ledger',       desc: 'View full account statement for any customer' },
  { key: 'addCustomers',     label: 'Add Customers',         desc: 'Register new customers while billing' },
  { key: 'addEditProducts',  label: 'Add / Edit Products',   desc: 'Quick-register products from the billing screen' },
];
return (
<ModalWrapper title={isEdit ? "Edit Team Member" : "Add Team Member"} onClose={() => setShowUserModal(false)}>
<form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Full Name / Username</label><input className={inputClass} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="e.g. Ali Raza" /></div>
{onFirebaseAuth ? (
  <div>
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Login Password</label>
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
      <p className="text-[11px] font-bold text-emerald-800 mb-2">Held by Firebase Authentication — not stored here.</p>
      <p className="text-[10px] text-slate-500 leading-relaxed mb-2">Forgotten password? Set a new one below. This issues the account a fresh login; the old password stops working immediately.</p>
      <div className="flex gap-2">
        <input type="text" className="flex-1 p-2 text-sm font-semibold border border-emerald-200 rounded-lg outline-none" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (6+ characters)" />
        <button type="button" disabled={resetting || newPassword.length < 6}
          onClick={async () => {
            setResetting(true);
            const res = await resetUserLogin(form, newPassword);
            setResetting(false);
            if (res.ok) { setNewPassword(''); showToast(`New password set for ${form.name}`); setShowUserModal(false); }
            else showToast(res.why, 'error');
          }}
          className="bg-emerald-600 disabled:bg-slate-300 text-white px-3 rounded-lg font-bold text-xs shrink-0">
          {resetting ? '…' : 'Set'}
        </button>
      </div>
    </div>
  </div>
) : (
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Login Password</label><input type="text" className={inputClass} value={form.password || ''} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Set Password" /></div>
)}
{onFirebaseAuth && (
  <div className={`rounded-xl border p-3 ${form.active === false ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold text-slate-700">{form.active === false ? 'Account disabled' : 'Account active'}</p>
        <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
          Disabling blocks all access but keeps their history. Use this when someone leaves —
          deleting them detaches their name from every invoice they raised.
        </p>
      </div>
      <button type="button" onClick={() => setForm({ ...form, active: form.active === false })}
        className={`shrink-0 px-3 py-2 rounded-lg font-bold text-[11px] border transition-colors ${form.active === false ? 'bg-white text-rose-700 border-rose-300' : 'bg-slate-800 text-white border-slate-800'}`}>
        {form.active === false ? 'Enable' : 'Disable'}
      </button>
    </div>
  </div>
)}
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Role</label><select className={inputClass} value={form.role} onChange={e=>setForm({...form, role: e.target.value})}><option value="staff">Sales Staff (Restricted)</option><option value="admin">Administrator (Full Access)</option></select></div>
{form.role === 'staff' && (
<div>
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block">Additional Access <span className="text-slate-400 normal-case font-medium">(all off = invoices & receipts only)</span></label>
  <div className="space-y-2">
    {PERMS.map(({ key, label, desc }) => (
      <label key={key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100">
        <input type="checkbox" checked={!!(form.permissions?.[key])} onChange={e => setPermission(key, e.target.checked)} className="w-4 h-4 accent-indigo-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-700 leading-tight">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
        </div>
      </label>
    ))}
  </div>
</div>
)}
<button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save User Record</button>
</form>
</ModalWrapper>
);
};
