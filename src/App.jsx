import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Package, ReceiptText, Settings, Plus, CheckCircle2, AlertCircle, Users, Wallet
} from 'lucide-react';
import {
  db, auth, firebaseConfig, collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, getAuth, initializeApp, deleteApp, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, authEmailFor, loginSlug
} from './firebase';
import { AUDIT, auditEntry, changedFields, notVoided, voidPatch, restorePatch } from './services/audit/auditLog';
import { APP_NAME, VEHICLES } from './helpers';
import PrintView from './components/PrintView';
import { buildCustomerLedger, allocateCredits, statusFromSettled } from './services/accounting/ledger';
import { AppContext } from './context/AppContext';
import { claimDocNumber } from './lib/claimDocNumber';
import { makeArrowNav } from './lib/a11y';
import { uploadToDrive } from './lib/driveBackup';
import { LOG_PAGE } from './lib/constants';
import { useLiveCollection } from './hooks/useLiveCollection';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { CustomersTab } from './components/tabs/CustomersTab';
import { ExpenseCategoryModal } from './components/modals/ExpenseCategoryModal';
import { PaymentModal } from './components/modals/PaymentModal';
import { CustomerModal } from './components/modals/CustomerModal';
import { RidersModal } from './components/modals/RidersModal';
import { UserModal } from './components/modals/UserModal';
import { ProductModal } from './components/modals/ProductModal';
import { CustomerLedgerModal } from './components/modals/CustomerLedgerModal';
import { SegmentsModal } from './components/modals/SegmentsModal';
import { CreditNoteModal } from './components/modals/CreditNoteModal';
import { PaymentsTab } from './components/tabs/PaymentsTab';
import { DashboardTab } from './components/tabs/DashboardTab';
import { BillingTab } from './components/tabs/BillingTab';
import { ProductsTab } from './components/tabs/ProductsTab';
import { AdminTab } from './components/tabs/AdminTab';




// ─── TOP-LEVEL MODAL COMPONENTS (outside App to prevent focus-loss on re-render) ───


function App() {
const [currentUser, setCurrentUser] = useState(() => {
try {
const item = window.localStorage.getItem('app_currentUser');
return item ? JSON.parse(item) : null;
} catch (error) { return null; }
});

useEffect(() => {
if (currentUser) {
window.localStorage.setItem('app_currentUser', JSON.stringify(currentUser));
} else {
window.localStorage.removeItem('app_currentUser');
}
}, [currentUser]);


const [loginForm, setLoginForm] = useState({ name: '', password: '' });
const [activeTab, setActiveTab] = useState('dashboard');
const [adminView, setAdminView] = useState('analytics');
const [analyticsView, setAnalyticsView] = useState('Overview');
const [toast, setToast] = useState(null);

// — Data State (Live from Firebase) —
// Tracks the Firebase session. Drives listener re-subscription (above) and clears a
// stale stored profile below.
// undefined = Firebase has not reported yet, null = definitely signed out. The distinction
// matters: treating the initial state as signed-out would clear a perfectly good persisted
// session on every page load and bounce the user to the login screen.
const [authUid, setAuthUid] = useState(undefined);
useEffect(() => onAuthStateChanged(auth, (fbUser) => setAuthUid(fbUser ? fbUser.uid : null)), []);

// A stored profile with no live Firebase session is a stale login — from before the Auth
// migration, or expired. Once the rules are closed every read it makes would be denied, so
// clear it and show the login screen rather than a broken app. Declared here, after
// authUid: as a dependency it is read during render, so it must already exist.
useEffect(() => {
  if (authUid === null) setCurrentUser(prev => (prev && prev.authUid ? null : prev));
}, [authUid]);

const appUsers = useLiveCollection('app_users', authUid);
const companies = useLiveCollection('companies', authUid);
const products = useLiveCollection('products', authUid);
const customers = useLiveCollection('customers', authUid);
// Financial collections come back raw and are filtered once, here. Every balance, report,
// export and list downstream reads the filtered arrays, so voiding a record subtracts it
// everywhere at once instead of in forty places one at a time. The raw arrays are exposed
// separately and used only by the Voided view.
const invoicesRaw = useLiveCollection('invoices', authUid);
const expensesRaw = useLiveCollection('expenses', authUid);
const paymentsRaw = useLiveCollection('payments', authUid);
const invoices = useMemo(() => invoicesRaw.filter(notVoided), [invoicesRaw]);
const expenses = useMemo(() => expensesRaw.filter(notVoided), [expensesRaw]);
const payments = useMemo(() => paymentsRaw.filter(notVoided), [paymentsRaw]);
const expenseCategories = useLiveCollection('expenseCategories', authUid);
const cities = useLiveCollection('cities', authUid);
const areas = useLiveCollection('areas', authUid);
const customerTypes = useLiveCollection('customerTypes', authUid);
const vehicleTypes = useLiveCollection('vehicleTypes', authUid);
const appSettingsRaw = useLiveCollection('appSettings', authUid);
const riders = useLiveCollection('riders', authUid);
// Courier registry for transport types that carry no rider (Intercity Transport et al).
// These are to non-rider vehicle types what riders are to rider-based ones.
const transportCompanies = useLiveCollection('transportCompanies', authUid);
const appSettings = appSettingsRaw.find(s => s.id === 'main') || { businessName: 'Khyber Traders', appName: 'AnimalHealth.PK', tagline: 'Wholesale Veterinary Pharmacy · Karachi', showBusinessNameOnDocs: true, showBusinessNameOnReports: true };

// Complex UI State
const [billingView, setBillingView] = useState('list');
const [currentInvoice, setCurrentInvoice] = useState(null);
const [showProductModal, setShowProductModal] = useState(false);
const [editingProduct, setEditingProduct] = useState(null);
const [productPreFill, setProductPreFill] = useState('');
const [showCustomerModal, setShowCustomerModal] = useState(false);
const [editingCustomer, setEditingCustomer] = useState(null);
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState(null);
const [showLedgerModal, setShowLedgerModal] = useState(false);
const [selectedLedgerId, setSelectedLedgerId] = useState(null);
const [showExpenseCatModal, setShowExpenseCatModal] = useState(false);
const [showUserModal, setShowUserModal] = useState(false);
const [editingUser, setEditingUser] = useState(null);
const [printConfig, setPrintConfig] = useState(null);
const [showSegmentsModal, setShowSegmentsModal] = useState(false);
const [showRidersModal, setShowRidersModal] = useState(false);
const [editingPayment, setEditingPayment] = useState(null);
const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
const [editingCreditNote, setEditingCreditNote] = useState(null);
const [confirmDialog, setConfirmDialog] = useState(null);
const showConfirm = (message) => new Promise(resolve => setConfirmDialog({ message, resolve }));
// Same dialog, with a text field. Resolves the trimmed string, or null if cancelled — a
// caller must be able to tell "no reason given" from "changed my mind".
const showPrompt = (message, prompt = {}) =>
  new Promise(resolve => setConfirmDialog({ message, prompt: { label: 'Reason', required: true, ...prompt }, resolve }));

const isAdmin = currentUser?.role === 'admin';
const hasPermission = (key) => isAdmin || !!(currentUser?.permissions?.[key]);

const showToast = (msg, type = 'success') => {
setToast({ msg, type });
setTimeout(() => setToast(null), 3000);
};

const getCompanyName = (id) => companies.find(c => c.id === id)?.name || 'Unknown';

const checkDuplicate = (list, name, excludeId = null) => {
return list.some(item => item.name.toLowerCase() === name.toLowerCase() && item.id !== excludeId);
};

const handleLogin = async (e) => {
e.preventDefault();
// First-run bootstrap deliberately does NOT gate on appUsers being empty any more.
// That list is unreadable from the login screen once the rules are closed, so the old
// check would have been true for everyone and every sign-in would have been diverted
// into bootstrap and rejected. The setup secret is the gate; it is attempted only after
// Firebase confirms there is no such account.
const bootstrapFirstAdmin = async () => {
  const setupSecret = import.meta.env.VITE_SETUP_SECRET;
  if (!setupSecret || loginForm.password !== setupSecret) return false;
  const email = authEmailFor(loginForm.name);
  const cred = await createUserWithEmailAndPassword(auth, email, loginForm.password);
  const id = Date.now().toString();
  const profile = { id, name: loginForm.name, role: 'admin', permissions: {},
                    authUid: cred.user.uid, authEmail: email, loginName: loginForm.name };
  await saveToFirebase('app_users', id, profile);
  await saveToFirebase('userRoles', cred.user.uid, {
    uid: cred.user.uid, appUserId: id, name: loginForm.name, role: 'admin', permissions: {}, active: true });
  await writeLoginIndex(profile, email);
  const defaultCats = ['Transport', 'Utility Bill', 'Staff Food/Tea', 'Maintenance', 'Other'];
  defaultCats.forEach((cat, i) => saveToFirebase('expenseCategories', Date.now()+i, { id: Date.now()+i, name: cat }));
  setCurrentUser({ id, name: loginForm.name, role: 'admin', permissions: {}, authUid: cred.user.uid });
  showToast("Welcome! Admin account created.");
  return true;
};
// Authenticate BEFORE touching the database. The old flow looked the user up in
// app_users to find their credentials, which cannot work once the rules are closed —
// a signed-out visitor may read nothing. So: resolve the username to a login address
// through the public loginIndex, sign in, and only then read anything.
const slug = loginSlug(loginForm.name);
let email = null;
try {
  const idx = await getDoc(doc(db, 'loginIndex', slug));
  if (idx.exists()) email = idx.data().authEmail;
} catch (err) {
  console.error('Login index lookup failed:', err);
}
// No index entry: fall back to the address derived from the name. Covers accounts
// migrated before the index existed, and anyone whose login has never been reset.
if (!email) email = authEmailFor(loginForm.name);

try {
  const cred = await signInWithEmailAndPassword(auth, email, loginForm.password);
  // Identity comes from the role mirror, keyed by uid — the one document a signed-in
  // user is always allowed to read about themselves.
  const roleSnap = await getDoc(doc(db, 'userRoles', cred.user.uid));
  if (!roleSnap.exists()) {
    await signOut(auth);
    showToast("Account is not set up — ask an admin to re-save it", "error");
    return;
  }
  const r = roleSnap.data();
  if (r.active === false) {
    await signOut(auth);
    showToast("This account has been disabled", "error");
    return;
  }
  setCurrentUser({ id: r.appUserId, name: r.name, role: r.role || 'staff', permissions: r.permissions || {}, authUid: cred.user.uid });
  showToast(`Welcome ${r.name}`);
} catch (err) {
  const noSuchAccount = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err.code);
  if (noSuchAccount) {
    try {
      if (await bootstrapFirstAdmin()) return;
    } catch (bootErr) {
      console.error('Bootstrap failed:', bootErr.code || bootErr);
    }
  }
  console.error('Sign-in failed:', err.code);
  showToast(err.code === 'auth/too-many-requests'
    ? "Too many attempts — wait a minute and try again"
    : "Invalid Credentials", "error");
}
};

// Write the username -> login address entry that sign-in reads before authenticating.
// Public by necessity: it is consulted while signed out. It holds no secret — just the
// synthetic address a username maps to.
const writeLoginIndex = async (user, email) => {
  const slug = loginSlug(user.loginName || user.name);
  await saveToFirebase('loginIndex', slug, { slug, authEmail: email, appUserId: user.id });
};

// Rewrite every migrated account's index entry. Idempotent and cheap; exists because the
// first accounts were migrated before the index did, and without an entry a reset login
// cannot be resolved at sign-in.
const repairLoginIndex = async () => {
  const migrated = appUsers.filter(u => u.authUid);
  for (const u of migrated) {
    await writeLoginIndex(u, u.authEmail || authEmailFor(u.loginName || u.name));
  }
  return migrated.length;
};

// Create or update a staff account, keeping all three records in step: the profile in
// app_users, the role mirror the security rules read, and the login index sign-in needs.
// Letting these drift is how someone ends up able to log in but authorised for nothing.
const saveUserAccount = async (form, isEdit) => {
  const permissions = form.role === 'admin' ? {} : (form.permissions || {});
  // Losing the last working admin leaves nobody able to write userRoles, and the rules
  // grant that to admins alone — so the app could never promote anyone again. Recovery
  // would mean hand-editing Firestore in the console. Refuse instead. Demoting and
  // disabling both remove an admin, so both are checked.
  const stillAdmin = form.role === 'admin' && form.active !== false;
  if (isEdit && !stillAdmin) {
    const workingAdmins = appUsers.filter(u => u.role === 'admin' && u.active !== false);
    if (workingAdmins.length <= 1 && workingAdmins.some(u => String(u.id) === String(form.id))) {
      return { ok: false, why: 'This is the only active admin. Give someone else admin access first, or nobody will be able to manage users.' };
    }
  }
  if (isEdit && form.active === false && String(form.id) === String(currentUser?.id)) {
    return { ok: false, why: 'You cannot disable your own account — you would be signed out with no way back in.' };
  }
  if (isEdit) {
    const { password, ...rest } = form;
    const profile = { ...rest, permissions };
    await saveToFirebase('app_users', form.id, profile);
    if (form.authUid) {
      await saveToFirebase('userRoles', form.authUid, {
        uid: form.authUid, appUserId: form.id, name: form.name,
        role: form.role || 'staff', permissions, active: form.active !== false,
      });
      await writeLoginIndex(profile, profile.authEmail || authEmailFor(profile.loginName || profile.name));
    }
    return { ok: true };
  }

  const id = Date.now().toString();
  const email = authEmailFor(form.name);
  if ((form.password || '').length < 6) return { ok: false, why: 'Password must be at least 6 characters.' };
  let secondary = null;
  try {
    secondary = initializeApp(firebaseConfig, 'newuser-' + id);
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), email, form.password);
    const profile = { id, name: form.name, role: form.role || 'staff', permissions,
                      authUid: cred.user.uid, authEmail: email, loginName: form.name };
    await saveToFirebase('app_users', id, profile);
    await saveToFirebase('userRoles', cred.user.uid, {
      uid: cred.user.uid, appUserId: id, name: form.name,
      role: form.role || 'staff', permissions, active: true,
    });
    await writeLoginIndex(profile, email);
    return { ok: true };
  } catch (err) {
    return { ok: false, why: err.code === 'auth/email-already-in-use'
      ? 'That username is already taken by an old login. Pick a slightly different name.'
      : err.code === 'auth/operation-not-allowed'
        ? 'Email/Password sign-in is not enabled in the Firebase console.'
        : (err.code || err.message) };
  } finally {
    if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
  }
};

// Give a migrated account a new password.
//
// The client SDK cannot change another user's password, and Firebase's reset-by-email
// flow needs a real mailbox — these synthetic addresses have none. Without this there is
// NO way to recover a forgotten password short of a backend, which would mean a permanent
// lockout. So: create a fresh Auth account under a new alias and repoint the user record.
//
// The old Auth account still exists and its password still opens it, so its role mirror
// MUST be deleted — under the strict rules a stale userRoles document would keep granting
// that old login full access.
const resetUserLogin = async (u, newPassword) => {
  if (!newPassword || newPassword.length < 6) return { ok: false, why: 'Password must be at least 6 characters.' };
  const base = authEmailFor(u.loginName || u.name).split('@')[0];
  const email = `${base}.${Date.now().toString(36)}@animalhealthpk.app`;
  const previousUid = u.authUid;
  let secondary = null;
  try {
    secondary = initializeApp(firebaseConfig, 'reset-' + u.id + '-' + Date.now());
    const sAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(sAuth, email, newPassword);
    const { password, ...rest } = u;
    await saveToFirebase('app_users', u.id, { ...rest, authUid: cred.user.uid, authEmail: email, loginName: u.loginName || u.name });
    await saveToFirebase('userRoles', cred.user.uid, {
      uid: cred.user.uid, appUserId: u.id, name: u.name,
      role: u.role || 'staff', permissions: u.permissions || {}, active: true,
    });
    if (previousUid && previousUid !== cred.user.uid) {
      await deleteFromFirebase('userRoles', previousUid);
    }
    // Point the username at the NEW address, or sign-in would keep resolving to the old
    // account and the reset would appear to do nothing.
    await writeLoginIndex(u, email);
    return { ok: true };
  } catch (err) {
    return { ok: false, why: err.code === 'auth/operation-not-allowed'
      ? 'Email/Password sign-in is not enabled in the Firebase console.'
      : (err.code || err.message) };
  } finally {
    if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
  }
};

// Migrate every account that still holds a stored password into Firebase Auth.
//
// Each account is created through a SECONDARY Firebase app instance: the client SDK signs
// you in as whoever it just created, which would kick the admin out of their own session
// halfway through the run. The secondary instance is discarded immediately after.
//
// Only clears the stored password once Firebase confirms the account exists, so a failure
// leaves that user still able to log in the old way.
const migrateUsersToAuth = async () => {
  const pending = appUsers.filter(u => !u.authUid);
  if (pending.length === 0) return { done: 0, failed: [] };
  const failed = [];
  let done = 0;

  for (const u of pending) {
    const email = authEmailFor(u.name);
    const pw = u.password || '';
    if (pw.length < 6) {
      failed.push({ name: u.name, why: 'Password is under 6 characters. Firebase requires 6+. Set a longer password for this user, then run this again.' });
      continue;
    }
    let secondary = null;
    try {
      secondary = initializeApp(firebaseConfig, 'migrate-' + u.id + '-' + Date.now());
      const sAuth = getAuth(secondary);
      let uid;
      try {
        const cred = await createUserWithEmailAndPassword(sAuth, email, pw);
        uid = cred.user.uid;
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          // A previous partial run already created it — adopt that account rather than
          // failing, but only if this password really opens it.
          const cred = await signInWithEmailAndPassword(sAuth, email, pw);
          uid = cred.user.uid;
        } else {
          throw err;
        }
      }
      const { password, ...withoutPassword } = u;
      await saveToFirebase('app_users', u.id, { ...withoutPassword, authUid: uid, authEmail: email, loginName: u.name });
      // Mirror the role under the Auth UID. Security rules can only get() a document by
      // path, and user documents are keyed by a timestamp id, not by uid — so without this
      // the rules have no way to look up who is asking. Keep it minimal: no password, no
      // personal data, just what an authorisation decision needs.
      await saveToFirebase('userRoles', uid, {
        uid,
        appUserId: u.id,
        name: u.name,
        role: u.role || 'staff',
        permissions: u.permissions || {},
        active: true,
      });
      await writeLoginIndex({ ...u, loginName: u.name }, email);
      done += 1;
    } catch (err) {
      failed.push({ name: u.name, why: err.code === 'auth/operation-not-allowed'
        ? 'Email/Password sign-in is not enabled in the Firebase console.'
        : (err.code || err.message) });
    } finally {
      if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
    }
  }
  return { done, failed };
};

// `merge` writes only the fields given, leaving the rest of the document alone. Default is
// a full replace, which is what almost every caller wants — but see the auto-backup below
// for the case where a replace silently undid somebody's edit.
const saveToFirebase = async (collectionName, id, dataObj, { merge = false } = {}) => {
try {
  const ack = setDoc(doc(db, collectionName, String(id)), dataObj, { merge });
  // Persistence is on, so the write applies locally at once but this promise only settles
  // when the SERVER acknowledges. On a bad connection it can stay pending indefinitely,
  // and the caller's success toast never runs — a save that appears to do nothing at all,
  // with no error either. Saying so is better than silence.
  let slow = false;
  const warn = setTimeout(() => { slow = true; showToast('Still saving — check your connection', 'error'); }, 6000);
  await ack;
  clearTimeout(warn);
  if (slow) showToast('Saved.');
} catch (e) {
console.error("Firebase Write Error:", e);
showToast("Network Error - Could not save", "error");
}
};

const vehicleTypesSeeded = React.useRef(false);
React.useEffect(() => {
  // Seed default vehicle types — only when Firestore has responded (appSettings loaded)
  // and the collection is genuinely empty. Predictable string IDs prevent duplicates.
  if (!appSettings?.id || vehicleTypes.length > 0 || vehicleTypesSeeded.current) return;
  vehicleTypesSeeded.current = true;
  const defaults = [
    { name: 'Rider',               requiresRider: true  },
    { name: 'Rickshaw',            requiresRider: true  },
    { name: 'Suzuki',              requiresRider: true  },
    { name: 'Intercity Transport', requiresRider: false },
    { name: 'Self-Pickup',         requiresRider: false },
  ];
  defaults.forEach(d => {
    const id = 'vt_' + d.name.replace(/\s+/g, '_');
    saveToFirebase('vehicleTypes', id, { id, name: d.name, requiresRider: d.requiresRider });
  });
}, [appSettings?.id, vehicleTypes.length]);

React.useEffect(() => {
  if (appSettings?.id === 'main' && appSettings.showBusinessNameOnDocs === undefined) {
    saveToFirebase('appSettings', 'main', { showBusinessNameOnDocs: true, showBusinessNameOnReports: true }, { merge: true });
  }
}, [appSettings?.id, appSettings?.showBusinessNameOnDocs]);

// Auto-backup (Firebase + Google Drive) — runs once per session when settings load
const autoBackupRan = React.useRef(false);
React.useEffect(() => {
  // Admins only. Once the rules are closed a staff member cannot read app_users, so their
  // backup would write an EMPTY copy over that day's real one — and every write would be
  // refused anyway, producing a failure toast per collection. Backing up is an admin job.
  if (autoBackupRan.current || !appSettings?.id || !isAdmin) return;
  const exportedAt = new Date().toISOString();
  const date = exportedAt.slice(0, 10);
  const isDue = (lastAt, freq) => {
    if (!freq || freq === 'never') return false;
    const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 30;
    return (Date.now() - (lastAt ? new Date(lastAt) : new Date(0)).getTime()) / 86400000 >= days;
  };

  const firebaseDue = isDue(appSettings.lastBackupAt, appSettings.backupFreq || appSettings.githubFreq);
  const driveDue = isDue(appSettings.lastDriveBackupAt, appSettings.driveFreq) && !!appSettings.driveScriptUrl;
  if (!firebaseDue && !driveDue) return;

  autoBackupRan.current = true;
  const cols = { app_users: appUsers, appSettings: [appSettings], companies, products, customers, invoices, expenses, expenseCategories, payments, riders, cities, areas, customerTypes, vehicleTypes };
  const backupObj = { exportedAt, collections: cols };

  if (firebaseDue) {
    Promise.all(Object.entries(cols).map(([col, items]) =>
      saveToFirebase('backups', `${date}_${col}`, { items: items || [], backedUpAt: exportedAt })
    ))
      // Stamp ONLY the timestamp, merged. This used to write { ...appSettings } back — a
      // snapshot captured before fifteen collections were uploaded — so anything the user
      // changed in Settings during those seconds was silently reverted to the old value.
      .then(() => saveToFirebase('appSettings', 'main', { lastBackupAt: exportedAt }, { merge: true }))
      .then(() => showToast('Auto-backup saved to Firebase'))
      .catch(e => console.warn('Firebase auto-backup failed:', e));
  }

  if (driveDue) {
    uploadToDrive(appSettings.driveScriptUrl, backupObj, appSettings.driveFolderId)
      .then(() => saveToFirebase('appSettings', 'main', { lastDriveBackupAt: exportedAt }, { merge: true }))
      .then(() => showToast('Auto-backup sent to Google Drive'))
      .catch(e => console.warn('Drive auto-backup failed:', e));
  }
}, [isAdmin, appSettings?.id, appSettings?.backupFreq, appSettings?.githubFreq, appSettings?.lastBackupAt, appSettings?.driveFreq, appSettings?.driveScriptUrl, appSettings?.lastDriveBackupAt]);

const deleteFromFirebase = async (collectionName, id) => {
try {
await deleteDoc(doc(db, collectionName, String(id)));
} catch (e) {
console.error("Firebase Delete Error:", e);
showToast("Network Error - Could not delete", "error");
}
};

// ── Audit log ──────────────────────────────────────────────────────────────
// Append-only in firestore.rules: any active user may create, nobody may update or delete.
// A failure here must never block the business action — a payment that saved and did not
// log is bad; a payment refused because the log was unreachable is worse. So this swallows
// its own errors and reports to the console only.
// auditLogs only ever grows, so it must never get a live listener — see
// docs/FIRESTORE_READS.md. One bounded read, newest first, when the tab is opened.
// Returns null on failure so the caller can tell "could not read" from "nothing logged".
const fetchAuditLog = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(LOG_PAGE)));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Audit log read failed:', e);
    return null;
  }
};

const writeAudit = async (entry) => {
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, 'auditLogs', id), { id, ...entry });
  } catch (e) {
    console.error('Audit write failed:', e);
  }
};

const logAction = (action, collectionName, record, extra = {}) => writeAudit(auditEntry({
  action,
  collection: collectionName,
  recordId: record?.id,
  label: extra.label ?? record?.id ?? '',
  reason: extra.reason || '',
  changes: extra.changes || [],
  user: currentUser,
}));

// Log a save, working out for itself whether this is a create or an edit and what moved.
// `before` is the record as it was, or null/undefined for a new one.
const logSave = (collectionName, before, after, label) => logAction(
  before ? AUDIT.UPDATE : AUDIT.CREATE, collectionName, after,
  { label, changes: before ? changedFields(before, after) : [] });

// For the hard deletes that legitimately remain — an estimate consumed by being issued as
// an invoice, say. Financial records are voided, not deleted, so this is deliberately rare.
const logDelete = (collectionName, record, reason, label) =>
  logAction(AUDIT.DELETE, collectionName, record, { label: label || record?.id, reason });

// ── Void ───────────────────────────────────────────────────────────────────
// Financial records are never removed. Voiding keeps the document, drops it out of every
// balance (the filter above), and records who and why. `reason` is mandatory: a void with
// no explanation answers none of the questions the log exists to answer.
const voidRecord = async (collectionName, record, { label, reason } = {}) => {
  if (!record?.id) return false;
  const voided = { ...record, ...voidPatch({ user: currentUser, reason }) };
  await saveToFirebase(collectionName, record.id, voided);
  await logAction(AUDIT.VOID, collectionName, record, { label: label || record.id, reason });
  return true;
};

const restoreRecord = async (collectionName, record, { label } = {}) => {
  if (!record?.id) return false;
  await saveToFirebase(collectionName, record.id, { ...record, ...restorePatch({ user: currentUser }) });
  await logAction(AUDIT.RESTORE, collectionName, record, { label: label || record.id });
  return true;
};

// — Ledger Engine —
// Delegates to the tested service so every screen computes a balance identically.
// Behaviour is unchanged from the inline version this replaced; ledger.test.js pins it.
const getCustomerLedger = (customerId) => buildCustomerLedger(customerId, { customers, invoices, payments });

// Payment status, derived rather than stored.
//
// The stored `paymentStatus` field was set by hand and never maintained, so an invoice
// still read "Pending" after the customer had paid — on screen, and in the analytics filter
// that counts paid invoices. Computed here from what the customer has actually paid.
//
// Built as one map per data change rather than per row: allocation is per-customer, so
// calling it inside a list render would be quadratic.
const paymentStatusById = useMemo(() => {
  const byId = new Map();
  const customerIds = [...new Set(invoices.filter(o => o.status === 'Billed').map(o => o.customerId))];
  customerIds.forEach(cid => {
    const settled = allocateCredits(cid, { invoices, payments });
    settled.forEach((amount, invoiceId) => {
      const inv = invoices.find(o => o.id === invoiceId);
      if (inv) byId.set(invoiceId, statusFromSettled(inv.total, amount));
    });
  });
  return byId;
}, [invoices, payments]);

// Falls back to the stored value only for records the allocator does not cover.
const getPaymentStatus = (invoice) =>
  (invoice && paymentStatusById.get(invoice.id)) || invoice?.paymentStatus || null;

const getCustomerBalance = (customerId) => {
const ledger = getCustomerLedger(customerId);
return ledger ? ledger.closingBal : 0;
};

const generateReceiptData = (ledger, rowId) => {
if (!ledger) return null;
const row = ledger.rows.find(r => r.id === rowId);
if(!row) return null;
const isInvoicePayment = row.id.endsWith('-PAY');
const actualId = isInvoicePayment ? row.ref : row.id;
const entryIndex = ledger.rows.findIndex(r => r.id === row.id);
const prevBalance = entryIndex > 0 ? ledger.rows[entryIndex - 1].balance : ledger.openingBal;
const payDiscount = row.discount || 0;
const amountReceived = row.credit - payDiscount;
return {
id: actualId,
date: row.date,
customerName: ledger.customerName,
receivedAmount: amountReceived,
discount: payDiscount,
totalCredit: row.credit,
prevBalance: prevBalance,
newBalance: row.balance,
note: row.desc
};
};

// Global keyboard shortcuts — must be BEFORE any conditional return (Rules of Hooks)
useEffect(() => {
  if (!currentUser) return;
  const handler = (e) => {
    if (e.altKey) {
      const map = { d: 'dashboard', i: 'products', b: 'billing', c: 'customers', a: 'admin' };
      if (map[e.key]) { e.preventDefault(); setActiveTab(map[e.key]); }
    }
    if (e.key === 'Escape') {
      if (printConfig) setPrintConfig(null);
      else if (showProductModal) setShowProductModal(false);
      else if (showCustomerModal) setShowCustomerModal(false);
      else if (showPaymentModal) { setEditingPayment(null); setShowPaymentModal(false); }
      else if (showCreditNoteModal) { setEditingCreditNote(null); setShowCreditNoteModal(false); }
      else if (showLedgerModal) setShowLedgerModal(false);
      else if (showUserModal) setShowUserModal(false);
      else if (showExpenseCatModal) setShowExpenseCatModal(false);
      else if (showSegmentsModal) setShowSegmentsModal(false);
      else if (showRidersModal) setShowRidersModal(false);
      else if (billingView === 'form') setBillingView('list');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [currentUser, printConfig, showProductModal, showCustomerModal, showPaymentModal, showCreditNoteModal, showLedgerModal, showUserModal, showExpenseCatModal, showSegmentsModal, showRidersModal, billingView]);

// Tab list & permission helpers — defined here so the redirect effect below can use them
// while still being BEFORE any conditional return (Rules of Hooks)
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home',     perm: 'viewDashboard' },
  { id: 'products',  icon: Package,         label: 'Items',    adminOnly: true },
  { id: 'billing',   icon: ReceiptText,     label: 'Billing' },
  { id: 'customers', icon: Users,           label: 'Clients',  perm: 'viewCustomers' },
  { id: 'payments',  icon: Wallet,          label: 'Receipts' },
  { id: 'admin',     icon: Settings,        label: 'Admin',    adminOnly: true },
];
const canSeeTab = (tab) => {
  if (tab.adminOnly) return isAdmin;
  if (tab.perm) return hasPermission(tab.perm);
  return true;
};
// Auto-redirect away from restricted tabs — must be BEFORE conditional return
useEffect(() => {
  const cur = TABS.find(t => t.id === activeTab);
  if (cur && !canSeeTab(cur)) setActiveTab('billing');
}, [activeTab, currentUser]);  // eslint-disable-line react-hooks/exhaustive-deps

// Toasts must be rendered by both the login screen and the main app. The login screen
// returns early, so anything defined only in the main render never appears there — which
// silently swallowed every login error, including "Invalid Credentials" on a wrong
// password. The screen simply did nothing.
const toastEl = toast && (
  <div className={`fixed top-6 right-6 lg:left-auto left-1/2 lg:-translate-x-0 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-xl z-[100] font-semibold text-white flex items-center gap-2.5 text-sm transition-all animate-slide-up ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>
    {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18} className="text-emerald-400"/>}
    {toast.msg}
  </div>
);

// — Auth Screen —
if (!currentUser) {
return (
<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-[Inter,system-ui,sans-serif]">
<div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
<div className="text-center mb-10">
<h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight">{APP_NAME}</h1>
<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Customer Management App</p>
</div>
<form onSubmit={handleLogin} className="space-y-5">
<div>
<label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
<input type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-semibold mt-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} />
</div>
<div>
<label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
<input type="password" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-semibold mt-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
</div>
<button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-indigo-600/20 mt-8 active:scale-[0.98] transition-all">Access System</button>
</form>
</div>
{toastEl}
</div>
);
}

const logout = async () => {
  try { await signOut(auth); } catch (e) { console.error('Sign-out failed:', e); }
  setCurrentUser(null);
};

// — Main Render —
const ctx = {
isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers,
cities, areas, customerTypes, vehicleTypes,
getPaymentStatus,
showToast, showConfirm, showPrompt, confirmDialog, setConfirmDialog, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData,
voidRecord, restoreRecord, logSave, logDelete, fetchAuditLog, claimDocNumber, invoicesRaw, paymentsRaw, expensesRaw,
billingView, setBillingView, currentInvoice, setCurrentInvoice,
activeTab, setActiveTab, adminView, setAdminView, analyticsView, setAnalyticsView,
editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill,
editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal,
showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment,
showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId,
showExpenseCatModal, setShowExpenseCatModal,
showUserModal, setShowUserModal, editingUser, setEditingUser,
setPrintConfig, printConfig,
showSegmentsModal, setShowSegmentsModal,
showRidersModal, setShowRidersModal,
riders, transportCompanies,
editingPayment, setEditingPayment,
showCreditNoteModal, setShowCreditNoteModal, editingCreditNote, setEditingCreditNote,
appSettings,
migrateUsersToAuth, resetUserLogin, repairLoginIndex, saveUserAccount, logout,
};
return (
<AppContext.Provider value={ctx}>
{/* ── Responsive wrapper: side-by-side on desktop, stacked on mobile ── */}
<div className="h-screen bg-slate-100 text-slate-900 font-[Inter,system-ui,sans-serif] flex flex-row print:hidden" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>

  {/* ── Desktop Sidebar Navigation (hidden on mobile) ── */}
  <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200 shadow-sm z-20 shrink-0">
    <div className="px-5 py-5 border-b border-slate-100">
      <h1 className="text-base font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight leading-none">{APP_NAME}</h1>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{currentUser?.name}</p>
    </div>
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {TABS.map(tab => {
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)} title={`Alt+${tab.label[0].toLowerCase()}`}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${active ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <div className="relative shrink-0">
              <tab.icon size={18} strokeWidth={active ? 2.5 : 2} />
              {draftCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">{draftCount > 9 ? '9+' : draftCount}</span>}
            </div>
            <span>{tab.label}</span>
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
          </button>
        );
      })}
    </nav>
    <div className="px-3 py-3 border-t border-slate-100">
      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2 px-1">Shortcuts: Alt+B=Billing, Alt+C=Clients</div>
      <button onClick={logout} className="w-full text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">Log Out</button>
    </div>
  </aside>

  {/* ── Main content area ── */}
  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
    {/* Mobile/tablet header */}
    <header className="lg:hidden bg-white/90 backdrop-blur-md px-5 py-4 flex justify-between items-center shadow-sm z-10 sticky top-0 border-b border-slate-100">
      <div>
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight leading-none pb-0.5">{APP_NAME}</h1>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{currentUser?.name}</p>
      </div>
      <button onClick={logout} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">Log Out</button>
    </header>

    {/* Desktop top bar */}
    <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-3 items-center justify-between shadow-sm z-10">
      <h2 className="text-base font-bold text-slate-800 capitalize">{TABS.find(t=>t.id===activeTab)?.label || ''}</h2>
      <div className="flex items-center gap-3">
        {activeTab === 'billing' && billingView === 'list' && (
          <button onClick={() => { setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' }); setBillingView('form'); }} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"><Plus size={16}/> New Invoice <kbd className="ml-1 text-[9px] bg-indigo-500 px-1.5 py-0.5 rounded font-mono">Alt+B</kbd></button>
        )}
        {activeTab === 'customers' && (
          <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm"><Wallet size={16}/> Receive Payment</button>
        )}
        <span className="text-[10px] text-slate-400 font-medium">Esc = back/close</span>
      </div>
    </header>

    <main className="flex-1 overflow-hidden h-full bg-slate-50 lg:bg-slate-100">
      <div className="relative h-full lg:max-w-4xl lg:mx-auto lg:my-0 bg-slate-50 lg:shadow-sm overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'admin' && <AdminTab />}
      </div>
    </main>

    {/* Mobile bottom nav */}
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-between pb-6 pt-3 px-2 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
      {TABS.map(tab => {
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
            className={`flex flex-col items-center justify-center w-full transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
            <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-indigo-50 shadow-sm' : ''}`}>
              <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
              {draftCount > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">{draftCount > 9 ? '9+' : draftCount}</span>}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${active ? 'text-indigo-700 mt-1' : 'mt-0.5'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  </div>

  {/* Print View - Rendered as separate component */}
  {printConfig && (
    <PrintView
      printConfig={printConfig}
      setPrintConfig={setPrintConfig}
      products={products}
      customers={customers}
      getCustomerLedger={getCustomerLedger}
      getCustomerBalance={getCustomerBalance}
      showToast={showToast}
      appSettings={appSettings}
    />
  )}

  {showProductModal && <ProductModal />}
  {showCustomerModal && <CustomerModal />}
  {showLedgerModal && <CustomerLedgerModal />}
  {showPaymentModal && <PaymentModal />}
  {showCreditNoteModal && <CreditNoteModal />}
  {showExpenseCatModal && <ExpenseCategoryModal />}
  {showUserModal && <UserModal />}
  {showSegmentsModal && <SegmentsModal />}
  {showRidersModal && <RidersModal />}
  <ConfirmDialog />

  {toastEl}

  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { font-family: 'Inter', system-ui, sans-serif; }
    @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .animate-slide-up { animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }
  `}</style>
</div>
</AppContext.Provider>

);
}

export default App;