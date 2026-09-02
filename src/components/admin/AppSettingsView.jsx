import React, { useState, useEffect, useContext } from 'react';
import { Save, Download, Upload, Database, ChevronDown } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { shareOrDownload } from '../../helpers';
import { uploadToDrive, getDriveScript } from '../../lib/driveBackup';
import { FixInvoiceUnitsButton } from './FixInvoiceUnitsButton';

export const AppSettingsView = () => {
const { appSettings, saveToFirebase, showToast, showConfirm, appUsers, companies, products, customers, invoices, expenses, expenseCategories, payments, cities, areas, customerTypes, vehicleTypes, riders, transportCompanies } = useContext(AppContext);
const [form, setForm] = useState({
  id: 'main',
  businessName: appSettings?.businessName || 'Khyber Traders',
  appName: appSettings?.appName || 'AnimalHealth.PK',
  tagline: appSettings?.tagline || 'Wholesale Veterinary Pharmacy · Karachi',
  phone: appSettings?.phone || '',
  email: appSettings?.email || '',
  address: appSettings?.address || '',
  showBusinessNameOnDocs: appSettings?.showBusinessNameOnDocs !== false,
  showBusinessNameOnReports: appSettings?.showBusinessNameOnReports !== false,
  backupFreq: appSettings?.backupFreq || appSettings?.githubFreq || 'weekly',
  driveScriptUrl: appSettings?.driveScriptUrl || '',
  driveFolderId: appSettings?.driveFolderId || '',
  driveFreq: appSettings?.driveFreq || 'weekly',
});
const [restoring, setRestoring] = useState(false);
const [firebaseBacking, setFirebaseBacking] = useState(false);
const [driveBacking, setDriveBacking] = useState(false);
const [showDriveSetup, setShowDriveSetup] = useState(false);
React.useEffect(() => {
  if (appSettings?.id) setForm({
    id: 'main',
    businessName: appSettings.businessName || 'Khyber Traders',
    appName: appSettings.appName || 'AnimalHealth.PK',
    tagline: appSettings.tagline || 'Wholesale Veterinary Pharmacy · Karachi',
    phone: appSettings.phone || '',
    email: appSettings.email || '',
    address: appSettings.address || '',
    showBusinessNameOnDocs: appSettings.showBusinessNameOnDocs !== false,
    showBusinessNameOnReports: appSettings.showBusinessNameOnReports !== false,
    backupFreq: appSettings.backupFreq || appSettings.githubFreq || 'weekly',
    driveScriptUrl: appSettings.driveScriptUrl || '',
    driveFolderId: appSettings.driveFolderId || '',
    driveFreq: appSettings.driveFreq || 'weekly',
  });
}, [appSettings?.id, appSettings?.businessName, appSettings?.showBusinessNameOnDocs, appSettings?.showBusinessNameOnReports, appSettings?.backupFreq, appSettings?.githubFreq, appSettings?.driveScriptUrl, appSettings?.driveFolderId, appSettings?.driveFreq]);
// Merged, not replaced. The form does not hold lastBackupAt or lastDriveBackupAt, so a
// full write wiped them — which told the auto-backup it was overdue and set it running on
// the next load, re-opening the very window in which it used to overwrite this save.
const saveSettings = async () => { await saveToFirebase('appSettings', 'main', form, { merge: true }); showToast('Settings saved!'); };
const downloadBackup = async () => {
  const backup = { exportedAt: new Date().toISOString(), collections: { app_users: appUsers, appSettings: appSettings ? [appSettings] : [], companies, products, customers, invoices, expenses, expenseCategories, payments, riders, transportCompanies, cities, areas, customerTypes, vehicleTypes } };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  await shareOrDownload(blob, `AnimalHealthPK_Backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`);
  showToast('Backup downloaded!');
};
const buildBackupObj = () => ({ exportedAt: new Date().toISOString(), collections: { app_users: appUsers, appSettings: appSettings ? [appSettings] : [], companies, products, customers, invoices, expenses, expenseCategories, payments, riders, transportCompanies, cities, areas, customerTypes, vehicleTypes } });
const manualFirebaseBackup = async () => {
  setFirebaseBacking(true);
  try {
    const backup = buildBackupObj();
    const date = new Date().toISOString().slice(0, 10);
    const cols = ['app_users', 'appSettings', 'companies', 'products', 'customers', 'invoices', 'expenses', 'expenseCategories', 'payments', 'riders', 'transportCompanies', 'cities', 'areas', 'customerTypes'];
    for (const col of cols) {
      await saveToFirebase('backups', `${date}_${col}`, { items: backup.collections[col] || [], backedUpAt: backup.exportedAt });
    }
    await saveToFirebase('appSettings', 'main', { ...appSettings, ...form, lastBackupAt: new Date().toISOString() });
    showToast('Backup saved to Firebase!');
  } catch(e) { showToast(`Backup failed: ${e.message}`, 'error'); }
  finally { setFirebaseBacking(false); }
};
const manualDriveBackup = async () => {
  const url = form.driveScriptUrl || appSettings?.driveScriptUrl;
  if (!url) return showToast('Paste the Apps Script URL first', 'error');
  setDriveBacking(true);
  try {
    await uploadToDrive(url, buildBackupObj(), form.driveFolderId || appSettings?.driveFolderId);
    await saveToFirebase('appSettings', 'main', { ...appSettings, ...form, lastDriveBackupAt: new Date().toISOString() });
    showToast('Backup sent to Google Drive!');
  } catch(e) { showToast(`Drive backup failed: ${e.message}`, 'error'); }
  finally { setDriveBacking(false); }
};
const handleRestoreFile = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  if (!await showConfirm('This will overwrite ALL existing data with the backup file. Are you sure?')) { e.target.value=''; return; }
  setRestoring(true);
  try {
    const backup = JSON.parse(await file.text()); let count = 0;
    for (const [col, docs] of Object.entries(backup.collections || {})) {
      for (const d of (docs || [])) { await saveToFirebase(col, d.id, d); count++; }
    }
    showToast(`Restore complete! ${count} records written. Please refresh.`, 'success');
  } catch { showToast('Restore failed — invalid backup file', 'error'); }
  setRestoring(false); e.target.value = '';
};
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
const totalRecords = invoices.length + customers.length + products.length + payments.length + expenses.length;
return (
<div className="flex-1 overflow-y-auto p-4 pb-28 space-y-5">
  <form onSubmit={e => { e.preventDefault(); saveSettings(); }} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <h3 className="font-black text-slate-800 text-base mb-1">Business Profile</h3>
    <p className="text-xs text-slate-400 mb-5">Used on invoices, receipts, and all generated documents.</p>
    <div className="space-y-4">
      <div><label className={labelCls}>Business / Company Name</label><input className={inputCls} value={form.businessName} onChange={e=>setForm(p=>({...p,businessName:e.target.value}))} placeholder="e.g. Khyber Traders" /></div>
      <div><label className={labelCls}>App Name (shown on documents)</label><input className={inputCls} value={form.appName} onChange={e=>setForm(p=>({...p,appName:e.target.value}))} placeholder="e.g. AnimalHealth.PK" /></div>
      <div><label className={labelCls}>Tagline</label><input className={inputCls} value={form.tagline} onChange={e=>setForm(p=>({...p,tagline:e.target.value}))} placeholder="e.g. Wholesale Veterinary Pharmacy · Karachi" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="+92 300 0000000" /></div>
        <div><label className={labelCls}>Email</label><input className={inputCls} value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="info@example.com" /></div>
      </div>
      <div><label className={labelCls}>Address</label><input className={inputCls} value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="City, Country" /></div>
    </div>
    <div className="mt-5 bg-slate-50 rounded-xl px-4 py-1 border border-slate-100">
      <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
        <div><div className="text-sm font-bold text-slate-700">Show on Invoices &amp; Documents</div><div className="text-[11px] text-slate-400 mt-0.5">Display business name in document headers and footers</div></div>
        <button type="button" onClick={()=>setForm(p=>({...p,showBusinessNameOnDocs:!p.showBusinessNameOnDocs}))} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showBusinessNameOnDocs?'bg-indigo-600':'bg-slate-300'}`}><span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.showBusinessNameOnDocs?'translate-x-6':'translate-x-1'}`}/></button>
      </div>
      <div className="flex items-start justify-between gap-4 py-3">
        <div><div className="text-sm font-bold text-slate-700">Show on Reports</div><div className="text-[11px] text-slate-400 mt-0.5">Display business name on printed analytics reports</div></div>
        <button type="button" onClick={()=>setForm(p=>({...p,showBusinessNameOnReports:!p.showBusinessNameOnReports}))} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showBusinessNameOnReports?'bg-indigo-600':'bg-slate-300'}`}><span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.showBusinessNameOnReports?'translate-x-6':'translate-x-1'}`}/></button>
      </div>
    </div>
    <button type="submit" className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
      <Save size={15}/> Save Settings
    </button>
  </form>
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <h3 className="font-black text-slate-800 text-base mb-1">Backup & Data Safety</h3>
    <p className="text-xs text-slate-400 mb-4">Download a full JSON backup of all your data. Store in Google Drive or another safe location. Recommended: weekly.</p>
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-amber-900 text-sm">Full Backup (JSON)</div>
          <div className="text-[11px] text-amber-700 mt-1">{invoices.length} invoices · {customers.length} customers · {products.length} products · {payments.length} payments · {expenses.length} expenses <span className="font-bold">({totalRecords} total records)</span></div>
        </div>
        <button onClick={downloadBackup} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shrink-0">
          <Download size={13}/> Download
        </button>
      </div>
    </div>
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
      <div className="font-black text-rose-900 text-sm mb-1">Restore from Backup ⚠</div>
      <p className="text-[11px] text-rose-700 mb-3">Overwrites all existing data. Only use to recover from data loss.</p>
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${restoring?'bg-slate-200 text-slate-400':'bg-rose-600 hover:bg-rose-700 text-white'}`}>
        <Upload size={13}/> {restoring?'Restoring…':'Choose Backup .json File'}
        <input type="file" accept=".json" onChange={handleRestoreFile} disabled={restoring} className="hidden" />
      </label>
    </div>
    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500">
      <strong className="text-slate-600">Also:</strong> Firebase Console → Firestore → Automated Backups for server-side backups (requires Blaze plan).
    </div>
  </div>
  <FixInvoiceUnitsButton />

  {/* ── Firebase Auto-Backup ── */}
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <h3 className="font-black text-slate-800 text-base mb-1 flex items-center gap-2"><Database size={16}/> Firebase Auto-Backup</h3>
    <p className="text-xs text-slate-400 mb-4">Saves a full backup to your Firebase database automatically. No token needed — uses your existing login.</p>
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Auto-Backup Frequency</label>
        <select className={inputCls} value={form.backupFreq} onChange={e => setForm(p=>({...p, backupFreq: e.target.value}))}>
          <option value="never">Never (manual only)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      {appSettings?.lastBackupAt && (
        <div className="text-[11px]">
          <span className="text-emerald-600 font-bold">Last backup: {appSettings.lastBackupAt.slice(0,10)}</span>
        </div>
      )}
    </div>
    <div className="flex gap-2 mt-4">
      <button type="button" onClick={saveSettings} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"><Save size={13}/> Save Settings</button>
      <button type="button" onClick={manualFirebaseBackup} disabled={firebaseBacking} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"><Upload size={13}/> {firebaseBacking ? 'Saving…' : 'Backup Now'}</button>
    </div>
  </div>

  {/* ── Google Drive Backup ── */}
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    <h3 className="font-black text-slate-800 text-base mb-1 flex items-center gap-2">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.71 3.5L1.15 15l3.43 5.5h12.84L22 15 15.29 3.5H7.71z" fill="#34A853" opacity=".6"/><path d="M1.15 15l3.43 5.5H10.5L7.07 15H1.15z" fill="#0F9D58"/><path d="M22 15l-3.43 5.5H10.5l3.43-5.5H22z" fill="#4285F4"/><path d="M15.29 3.5H7.71L10.5 8.5h3l2.79-5z" fill="#FBBC05"/><path d="M7.71 3.5L1.15 15h6.07L13.5 8.5l-2.79-5H7.71z" fill="#34A853"/><path d="M15.29 3.5L22 15h-6.07L10.5 8.5l2.79-5h2z" fill="#4285F4"/></svg>
      Google Drive Backup
    </h3>
    <p className="text-xs text-slate-400 mb-4">Saves a single JSON file to your Google Drive folder. No size limit. Requires a one-time Apps Script setup.</p>
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Drive Folder ID</label>
        <input className={inputCls} placeholder="e.g. 1vIGbDIEcbVw8Ocz3Dve63mDyCB4rFSJN"
          value={form.driveFolderId} onChange={e => setForm(p=>({...p, driveFolderId: e.target.value.trim()}))}/>
        <p className="text-[10px] text-slate-400 mt-1">Copy the long ID from your Drive folder's URL. The generated script below will use it automatically.</p>
      </div>
      <div>
        <label className={labelCls}>Apps Script URL</label>
        <input type="password" className={inputCls} placeholder="https://script.google.com/macros/s/…/exec"
          value={form.driveScriptUrl} onChange={e => setForm(p=>({...p, driveScriptUrl: e.target.value}))} autoComplete="off"/>
      </div>
      <div>
        <label className={labelCls}>Auto-Backup Frequency</label>
        <select className={inputCls} value={form.driveFreq} onChange={e => setForm(p=>({...p, driveFreq: e.target.value}))}>
          <option value="never">Never (manual only)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      {appSettings?.lastDriveBackupAt && (
        <div className="text-[11px]">
          <span className="text-emerald-600 font-bold">Last backup: {appSettings.lastDriveBackupAt.slice(0,10)}</span>
        </div>
      )}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowDriveSetup(p => !p)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
          <span>How to set up (one time, 2 minutes)</span>
          <ChevronDown size={13} className={`transition-transform ${showDriveSetup ? 'rotate-180' : ''}`}/>
        </button>
        {showDriveSetup && (
          <div className="px-4 pb-4 space-y-2 text-[11px] text-slate-600 border-t border-slate-100">
            <ol className="list-decimal list-inside space-y-1 mt-3">
              <li>Open <strong>script.google.com</strong> → New project</li>
              <li>Delete the default code and paste the script below</li>
              <li>Click <strong>Deploy → New deployment → Web app</strong></li>
              <li>Set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong></li>
              <li>Click Deploy → copy the deployment URL → paste it in the field above</li>
            </ol>
            <div className="relative mt-3">
              <pre className="bg-slate-900 text-emerald-300 text-[10px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{getDriveScript(form.driveFolderId)}</pre>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(getDriveScript(form.driveFolderId)); showToast('Script copied!'); }}
                className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    <div className="flex gap-2 mt-4">
      <button type="button" onClick={saveSettings} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"><Save size={13}/> Save Settings</button>
      <button type="button" onClick={manualDriveBackup} disabled={!form.driveScriptUrl || driveBacking} className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"><Upload size={13}/> {driveBacking ? 'Sending…' : 'Backup Now'}</button>
    </div>
  </div>
</div>
);
};
