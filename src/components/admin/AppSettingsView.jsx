import React, { useState, useEffect, useContext } from 'react';
import { Save, Download, Upload, Database, ChevronDown, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { shareOrDownload } from '../../helpers';
import { uploadToDrive, getDriveScript } from '../../lib/driveBackup';
import { inspectBackupText, planWrites, backupAgeDays } from '../../services/backup/restore';
import { SYNCED, QUEUED, isAccepted } from '../../lib/pendingWrite';
import { FixInvoiceUnitsButton } from './FixInvoiceUnitsButton';
import { OfflineReadinessPanel } from './OfflineReadinessPanel';

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
// A restore is inspected and shown before a single record is written. It used to write
// straight from the file picker, on any JSON at all, and report success either way.
const [pending, setPending] = useState(null);   // { inspection, fileName }
const [restoreProgress, setRestoreProgress] = useState(null);
const [safetyTaken, setSafetyTaken] = useState(false);
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
// Step one: read the file and show what is in it. Nothing is written here.
const handleRestoreFile = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const inspection = inspectBackupText(await file.text());
  setSafetyTaken(false);
  setRestoreProgress(null);
  if (!inspection.ok) {
    setPending(null);
    return showToast(inspection.errors[0] || 'That file cannot be restored', 'error');
  }
  setPending({ inspection, fileName: file.name });
};

// Step two, after the person has seen the contents and confirmed.
//
// The old loop counted its own iterations, and saveToFirebase swallowed every error, so a
// restore where nothing landed still said every record was written. It reports what the
// server actually acknowledged now, and names the first few failures.
const runRestore = async () => {
  if (!pending) return;
  const writes = planWrites(pending.inspection);
  if (!await showConfirm(
    `Write ${writes.length} records over your live data? Records created since this backup will NOT be removed.`)) return;

  setRestoring(true);
  // saveToFirebase returns 'synced' | 'queued' | 'failed'. All three are non-empty strings,
  // so `if (result)` would count a failure as a success — which is the bug this whole
  // screen was rewritten to remove. Count the three apart, and report them apart: a restore
  // run offline is legitimate and finishes entirely in the 'queued' column.
  let synced = 0;
  let queued = 0;
  const failed = [];
  for (let i = 0; i < writes.length; i++) {
    const w = writes[i];
    const result = await saveToFirebase(w.collection, w.id, w.data, { silent: true });
    if (result === SYNCED) synced += 1;
    else if (result === QUEUED) queued += 1;
    if (!isAccepted(result)) failed.push(`${w.collection}/${w.id}`);
    if (i % 25 === 0 || i === writes.length - 1) setRestoreProgress({ done: i + 1, total: writes.length });
  }
  setRestoring(false);
  setPending(null);
  setRestoreProgress(null);

  if (failed.length > 0) {
    console.error('[restore] writes the server rejected:', failed);
    showToast(`${synced + queued} of ${writes.length} restored — ${failed.length} failed. See the console.`, 'error');
  } else if (queued > 0) {
    showToast(`Restored ${synced + queued} records — ${queued} still to reach the server. Stay connected until they do.`, 'success');
  } else {
    showToast(`Restored ${synced} records. Please refresh.`, 'success');
  }
};
const inputCls = "w-full p-3 bg-white border border-kt-line rounded-xl text-sm font-medium outline-none focus:border-kt-ink";
const labelCls = "block text-xs font-medium text-kt-sub   mb-1.5";
const totalRecords = invoices.length + customers.length + products.length + payments.length + expenses.length;
return (
<div className="flex-1 overflow-y-auto p-4 pb-28 space-y-5">
  <form onSubmit={e => { e.preventDefault(); saveSettings(); }} className="bg-white rounded-xl p-5 border border-kt-line">
    <h3 className="font-semibold text-kt-ink text-base mb-1">Business Profile</h3>
    <p className="text-xs text-kt-muted mb-5">Used on invoices, receipts, and all generated documents.</p>
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
    <div className="mt-5 bg-kt-raised rounded-xl px-4 py-1 border border-kt-line">
      <div className="flex items-start justify-between gap-4 py-3 border-b border-kt-line">
        <div><div className="text-sm font-medium text-kt-ink">Show on Invoices &amp; Documents</div><div className="text-xs text-kt-muted mt-0.5">Display business name in document headers and footers</div></div>
        <button type="button" onClick={()=>setForm(p=>({...p,showBusinessNameOnDocs:!p.showBusinessNameOnDocs}))} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showBusinessNameOnDocs?'bg-kt-primary':'bg-kt-line'}`}><span className={`inline-block h-4 w-4 rounded-full bg-white  transition-transform ${form.showBusinessNameOnDocs?'translate-x-6':'translate-x-1'}`}/></button>
      </div>
      <div className="flex items-start justify-between gap-4 py-3">
        <div><div className="text-sm font-medium text-kt-ink">Show on Reports</div><div className="text-xs text-kt-muted mt-0.5">Display business name on printed analytics reports</div></div>
        <button type="button" onClick={()=>setForm(p=>({...p,showBusinessNameOnReports:!p.showBusinessNameOnReports}))} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showBusinessNameOnReports?'bg-kt-primary':'bg-kt-line'}`}><span className={`inline-block h-4 w-4 rounded-full bg-white  transition-transform ${form.showBusinessNameOnReports?'translate-x-6':'translate-x-1'}`}/></button>
      </div>
    </div>
    <button type="submit" className="mt-5 w-full bg-kt-primary hover:bg-kt-primary/90 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
      <Save size={15}/> Save Settings
    </button>
  </form>
  <div className="bg-white rounded-xl p-5 border border-kt-line">
    <h3 className="font-semibold text-kt-ink text-base mb-1">Backup & Data Safety</h3>
    <p className="text-xs text-kt-muted mb-4">Download a full JSON backup of all your data. Store in Google Drive or another safe location. Recommended: weekly.</p>
    <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-kt-amber text-sm">Full Backup (JSON)</div>
          <div className="text-xs text-kt-amber mt-1">{invoices.length} invoices · {customers.length} customers · {products.length} products · {payments.length} payments · {expenses.length} expenses <span className="font-medium">({totalRecords} total records)</span></div>
        </div>
        <button onClick={downloadBackup} className="bg-kt-amber hover:bg-kt-amber text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shrink-0">
          <Download size={13}/> Download
        </button>
      </div>
    </div>
    <div className="bg-kt-red/10 border border-kt-red/30 rounded-xl p-4">
      <div className="font-semibold text-kt-red text-sm mb-1">Restore from Backup ⚠</div>
      {/* "Overwrites all existing data" was not true and is not what a person should be
          told before a restore. It writes the backup's records over the live ones; a
          record created since the backup is left exactly where it is. */}
      <p className="text-xs text-kt-red mb-3">
        Writes the records in the file over your live data. Anything created <em>since</em> the
        backup is left alone — this is not a wipe-and-replace. You will see what is in the file
        before anything is written.
      </p>
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer ${restoring?'bg-kt-line text-kt-muted':'bg-kt-red hover:bg-kt-red/90 text-white'}`}>
        <Upload size={13}/> {restoring?'Restoring…':'Choose Backup .json File'}
        <input type="file" accept=".json" onChange={handleRestoreFile} disabled={restoring} className="hidden" />
      </label>

      {pending && (() => {
        const { inspection, fileName } = pending;
        const age = backupAgeDays(inspection.exportedAt);
        return (
          <div className="mt-3 bg-white border border-kt-red/30 rounded-xl overflow-hidden">
            <div className="flex justify-between items-center gap-2 p-3 border-b border-kt-red/30 bg-kt-red/10">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-kt-red truncate">{fileName}</p>
                <p className="text-xs text-kt-red">
                  {inspection.exportedAt
                    ? `Exported ${new Date(inspection.exportedAt).toLocaleString()}${age !== null ? ` · ${age} day${age === 1 ? '' : 's'} old` : ''}`
                    : 'No export date in the file'}
                </p>
              </div>
              <button onClick={() => { setPending(null); setSafetyTaken(false); }} title="Cancel" className="p-1.5 bg-white rounded-lg text-kt-muted hover:text-kt-ink border border-kt-line shrink-0"><X size={14}/></button>
            </div>

            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-kt-sub">
                {inspection.totalRecords.toLocaleString('en-US')} records will be written
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {inspection.collections.map(c => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span className="font-semibold text-kt-sub truncate">{c.name}</span>
                    <span className="font-semibold text-kt-ink ml-2 shrink-0">{c.count.toLocaleString('en-US')}</span>
                  </div>
                ))}
              </div>

              {inspection.refused.length > 0 && (
                <div className="pt-2 border-t border-kt-line">
                  <p className="text-xs font-medium text-kt-sub mb-1 flex items-center gap-1"><ShieldCheck size={11}/> Not restored</p>
                  {inspection.refused.map(r => (
                    <p key={r.name} className="text-xs text-kt-sub"><span className="font-medium text-kt-ink">{r.name}</span> — {r.reason}</p>
                  ))}
                </div>
              )}

              {inspection.warnings.length > 0 && (
                <div className="pt-2 border-t border-kt-line space-y-1">
                  {inspection.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-kt-amber flex items-start gap-1"><AlertTriangle size={11} className="shrink-0 mt-0.5"/><span>{w}</span></p>
                  ))}
                </div>
              )}
            </div>

            {restoreProgress ? (
              <div className="p-3 border-t border-kt-red/30">
                <p className="text-xs font-medium text-kt-sub mb-1">Writing {restoreProgress.done.toLocaleString('en-US')} of {restoreProgress.total.toLocaleString('en-US')}…</p>
                <div className="w-full bg-kt-raised rounded-full h-1.5"><div className="bg-kt-red h-1.5 rounded-full" style={{ width: `${(restoreProgress.done / restoreProgress.total) * 100}%` }}></div></div>
              </div>
            ) : (
              <div className="p-3 border-t border-kt-red/30 space-y-2">
                {/* The brief asks for this and it was never there: a restore is itself a
                    destructive write, and the state before it should be recoverable. */}
                <button
                  onClick={async () => { await downloadBackup(); setSafetyTaken(true); }}
                  disabled={restoring}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border ${safetyTaken ? 'bg-kt-green/10 border-kt-green/30 text-kt-green' : 'bg-white border-kt-line text-kt-ink hover:bg-kt-raised'}`}
                >
                  {safetyTaken ? <><ShieldCheck size={13}/> Current data downloaded</> : <><Download size={13}/> 1. Download current data first</>}
                </button>
                <button
                  onClick={runRestore}
                  disabled={restoring}
                  className="w-full px-4 py-2 rounded-lg text-xs font-medium bg-kt-red hover:bg-kt-red/90 text-white disabled:bg-kt-line disabled:text-kt-muted"
                >
                  2. Restore {inspection.totalRecords.toLocaleString('en-US')} records
                </button>
                {!safetyTaken && <p className="text-xs text-kt-muted text-center">Downloading first is not required, but it is the only way back.</p>}
              </div>
            )}
          </div>
        );
      })()}
    </div>
    <div className="mt-4 p-3 bg-kt-raised rounded-xl border border-kt-line text-xs text-kt-sub">
      <strong className="text-kt-sub">Also:</strong> Firebase Console → Firestore → Automated Backups for server-side backups (requires Blaze plan).
    </div>
  </div>
  <FixInvoiceUnitsButton />

  <OfflineReadinessPanel />

  {/* ── Firebase Auto-Backup ── */}
  <div className="bg-white rounded-xl p-5 border border-kt-line">
    <h3 className="font-semibold text-kt-ink text-base mb-1 flex items-center gap-2"><Database size={16}/> Firebase Auto-Backup</h3>
    <p className="text-xs text-kt-muted mb-4">Saves a full backup to your Firebase database automatically. No token needed — uses your existing login.</p>
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
        <div className="text-xs">
          <span className="text-kt-green font-medium">Last backup: {appSettings.lastBackupAt.slice(0,10)}</span>
        </div>
      )}
    </div>
    <div className="flex gap-2 mt-4">
      <button type="button" onClick={saveSettings} className="flex-1 bg-kt-primary hover:bg-kt-primary/90 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"><Save size={13}/> Save Settings</button>
      <button type="button" onClick={manualFirebaseBackup} disabled={firebaseBacking} className="flex-1 bg-kt-band hover:bg-kt-line text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"><Upload size={13}/> {firebaseBacking ? 'Saving…' : 'Backup Now'}</button>
    </div>
  </div>

  {/* ── Google Drive Backup ── */}
  <div className="bg-white rounded-xl p-5 border border-kt-line">
    <h3 className="font-semibold text-kt-ink text-base mb-1 flex items-center gap-2">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.71 3.5L1.15 15l3.43 5.5h12.84L22 15 15.29 3.5H7.71z" fill="#34A853" opacity=".6"/><path d="M1.15 15l3.43 5.5H10.5L7.07 15H1.15z" fill="#0F9D58"/><path d="M22 15l-3.43 5.5H10.5l3.43-5.5H22z" fill="#4285F4"/><path d="M15.29 3.5H7.71L10.5 8.5h3l2.79-5z" fill="#FBBC05"/><path d="M7.71 3.5L1.15 15h6.07L13.5 8.5l-2.79-5H7.71z" fill="#34A853"/><path d="M15.29 3.5L22 15h-6.07L10.5 8.5l2.79-5h2z" fill="#4285F4"/></svg>
      Google Drive Backup
    </h3>
    <p className="text-xs text-kt-muted mb-4">Saves a single JSON file to your Google Drive folder. No size limit. Requires a one-time Apps Script setup.</p>
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Drive Folder ID</label>
        <input className={inputCls} placeholder="e.g. 1vIGbDIEcbVw8Ocz3Dve63mDyCB4rFSJN"
          value={form.driveFolderId} onChange={e => setForm(p=>({...p, driveFolderId: e.target.value.trim()}))}/>
        <p className="text-xs text-kt-muted mt-1">Copy the long ID from your Drive folder's URL. The generated script below will use it automatically.</p>
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
        <div className="text-xs">
          <span className="text-kt-green font-medium">Last backup: {appSettings.lastDriveBackupAt.slice(0,10)}</span>
        </div>
      )}
      <div className="border border-kt-line rounded-xl overflow-hidden">
        <button type="button" onClick={() => setShowDriveSetup(p => !p)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-kt-sub hover:bg-kt-raised">
          <span>How to set up (one time, 2 minutes)</span>
          <ChevronDown size={13} className={`transition-transform ${showDriveSetup ? 'rotate-180' : ''}`}/>
        </button>
        {showDriveSetup && (
          <div className="px-4 pb-4 space-y-2 text-xs text-kt-sub border-t border-kt-line">
            <ol className="list-decimal list-inside space-y-1 mt-3">
              <li>Open <strong>script.google.com</strong> → New project</li>
              <li>Delete the default code and paste the script below</li>
              <li>Click <strong>Deploy → New deployment → Web app</strong></li>
              <li>Set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong></li>
              <li>Click Deploy → copy the deployment URL → paste it in the field above</li>
            </ol>
            <div className="relative mt-3">
              <pre className="bg-kt-band text-kt-green text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{getDriveScript(form.driveFolderId)}</pre>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(getDriveScript(form.driveFolderId)); showToast('Script copied!'); }}
                className="absolute top-2 right-2 bg-kt-line hover:bg-kt-line text-white text-xs font-medium px-2 py-1 rounded">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    <div className="flex gap-2 mt-4">
      <button type="button" onClick={saveSettings} className="flex-1 bg-kt-primary hover:bg-kt-primary/90 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"><Save size={13}/> Save Settings</button>
      <button type="button" onClick={manualDriveBackup} disabled={!form.driveScriptUrl || driveBacking} className="flex-1 bg-kt-green/90 hover:bg-kt-green/90 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"><Upload size={13}/> {driveBacking ? 'Sending…' : 'Backup Now'}</button>
    </div>
  </div>
</div>
);
};
