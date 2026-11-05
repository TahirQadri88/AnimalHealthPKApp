import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Package, ReceiptText, Settings, Plus, CheckCircle2, AlertCircle, Users, Wallet, Search
} from 'lucide-react';
import {
  db, auth, firebaseConfig, collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, getAuth, initializeApp, deleteApp, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, authEmailFor, loginSlug
} from './firebase';
import { AUDIT, auditEntry, changedFields, notVoided, voidPatch, restorePatch } from './services/audit/auditLog';
import { APP_NAME, VEHICLES } from './helpers';
import PrintView from './components/PrintView';
import { buildCustomerLedger, allocateCredits, statusFromSettled } from './services/accounting/ledger';
import { AppContext } from './context/AppContext';
import { nextDocNumber, ensureBlocks } from './lib/claimDocNumber';
import { getNextSeqNum } from './lib/docNumbers';
import { settleWrite, FAILED } from './lib/pendingWrite';
import { signInErrorMessage, OFFLINE_MESSAGE } from './lib/loginErrors';
import { makeArrowNav } from './lib/a11y';
import { uploadToDrive } from './lib/driveBackup';
import { LOG_PAGE } from './lib/constants';
import { productsNeedingCost } from './lib/costPending';
import { useLiveCollection } from './hooks/useLiveCollection';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { CustomersTab } from './components/tabs/CustomersTab';
import { ExpenseCategoryModal } from './components/modals/ExpenseCategoryModal';
import { PaymentModal } from './components/modals/PaymentModal';
import { CustomerModal } from './components/modals/CustomerModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { SyncPill } from './components/ui/SyncPill';
import { useSyncStatus } from './hooks/useSyncStatus';
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
// One search box over customers, invoices, receipts, products and brands. Alt+S, or the
// magnifier in either header.
const [showSearchModal, setShowSearchModal] = useState(false);
// Whether anything on screen has reached the server. Also what the logout guard reads —
// see below.
const sync = useSyncStatus();
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
//
// But NOT while offline. Signing in needs the network, so dropping someone to the login
// screen during an outage is the same lockout as pressing Log Out — arriving without anyone
// pressing anything. Firebase Auth restores its session from IndexedDB without a network
// and should not report null here, but "should not" is not a guarantee worth betting a
// day's billing on. A genuinely revoked session is cleared the moment the connection
// returns, and offline it can do nothing anyway: the rules are enforced on the server.
useEffect(() => {
  if (authUid !== null) return;
  if (navigator.onLine === false) {
    console.warn('[auth] no Firebase session while offline — keeping the local session rather than locking the user out');
    return;
  }
  setCurrentUser(prev => (prev && prev.authUid ? null : prev));
}, [authUid]);

// Admins only. The rules let staff read nothing here but their own profile, so a staff
// listener on the whole collection is refused — and a refused listener that had first served
// the device's cache left the sync pill stuck on "No connection". Staff never read this list.
// (currentUser, not isAdmin: isAdmin is declared further down, and this runs at render.)
const appUsers = useLiveCollection('app_users', currentUser?.role === 'admin' ? authUid : null);
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
// Authenticate BEFORE touching the database. The old flow looked the user up in
// app_users to find their credentials, which cannot work once the rules are closed —
// a signed-out visitor may read nothing. So: resolve the username to a login address
// through the public loginIndex, sign in, and only then read anything.
// Signing in needs the network in two places — the index lookup and the password check —
// and Firebase Auth cannot verify a password offline under any configuration. Saying so
// before trying beats a round trip that ends in a misleading error.
if (navigator.onLine === false) return showToast(OFFLINE_MESSAGE, 'error');
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
  // Everything that was not rate-limiting used to be reported as "Invalid Credentials",
  // so an outage told a person with a perfectly good password that it was wrong — which
  // invites them to doubt it, retry, and ask for a reset, none of which helps.
  console.error('Sign-in failed:', err.code);
  showToast(signInErrorMessage(err.code, { online: navigator.onLine !== false }), 'error');
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
// Returns 'synced', 'queued' or 'failed' — see src/lib/pendingWrite.js.
//
// Persistence is on, so a write applies to the local cache at once and is queued in
// IndexedDB where it survives closing the browser; but setDoc's promise settles only when
// the SERVER acknowledges, and offline it never settles. `await` on it therefore hung, and
// every caller hung with it — the record safe on the device and the app saying it was
// stuck. settleWrite stops waiting after a short timeout and calls that outcome QUEUED,
// which is a success: Firestore will send it.
//
// This replaces the six-second "Still saving" toast, which fired while the caller was still
// blocked and told the user to check a connection that had already done its job. The
// standing signal for "not yet on the server" belongs in the sync indicator, not in a toast
// per save.
//
// `silent` suppresses the toasts for a caller doing many writes at once, which would
// otherwise stack one error per record.
//
// Do NOT test the result for truthiness — all three outcomes are non-empty strings. Use
// isAccepted from pendingWrite.
const saveToFirebase = async (collectionName, id, dataObj, { merge = false, silent = false } = {}) => {
  const ack = setDoc(doc(db, collectionName, String(id)), dataObj, { merge })
    .catch(e => { console.error('Firebase Write Error:', e); throw e; });
  const result = await settleWrite(ack, {
    // A write the rules refuse is only refused once it reaches the server, which can be
    // long after we reported it queued. Swallowing that is how data quietly goes missing.
    onLateFailure: () => { if (!silent) showToast('A saved change was rejected by the server', 'error'); },
  });
  if (result === FAILED && !silent) showToast('Network Error - Could not save', 'error');
  return result;
};

const vehicleTypesSeeded = React.useRef(false);
React.useEffect(() => {
  // Seed default vehicle types — only when Firestore has responded (appSettings loaded)
  // and the collection is genuinely empty. Predictable string IDs prevent duplicates.
  // Admins only: the rules refuse anyone else, so on a staff login this could only fail.
  if (!isAdmin || !appSettings?.id || vehicleTypes.length > 0 || vehicleTypesSeeded.current) return;
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
}, [isAdmin, appSettings?.id, vehicleTypes.length]);

React.useEffect(() => {
  if (isAdmin && appSettings?.id === 'main' && appSettings.showBusinessNameOnDocs === undefined) {
    saveToFirebase('appSettings', 'main', { showBusinessNameOnDocs: true, showBusinessNameOnReports: true }, { merge: true });
  }
}, [isAdmin, appSettings?.id, appSettings?.showBusinessNameOnDocs]);

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

// Same three outcomes, and the same reason: deleteDoc's promise also waits for the server,
// so this hung offline exactly as saveToFirebase did. The deletion applies to the local
// cache at once, so the record disappears from every screen immediately either way.
const deleteFromFirebase = async (collectionName, id) => {
  const ack = deleteDoc(doc(db, collectionName, String(id)))
    .catch(e => { console.error('Firebase Delete Error:', e); throw e; });
  const result = await settleWrite(ack, {
    onLateFailure: () => showToast('A deletion was rejected by the server', 'error'),
  });
  if (result === FAILED) showToast('Network Error - Could not delete', 'error');
  return result;
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

// The second hang on the save path, and the reason fixing claimDocNumber alone would not
// have been enough: saveInvoice awaits logSave before it shows its toast, and a bare
// `await setDoc` never settles offline. A failed audit write is deliberately swallowed — a
// payment that saved without logging is bad, a payment refused because the log was
// unreachable is worse — and an unanswered one must be treated the same way.
const writeAudit = async (entry) => {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ack = setDoc(doc(db, 'auditLogs', id), { id, ...entry })
    .catch(e => { console.error('Audit write failed:', e); throw e; });
  return settleWrite(ack, { onLateFailure: (e) => console.error('Audit write rejected after queueing:', e) });
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

// Reserve document numbers ahead of an outage.
//
// A number is only guaranteed unique by the transaction that reserved it, and a transaction
// cannot run offline. So the reserving happens now, while there is a connection: one
// transaction per prefix advances the counter by ten and hands this device that range
// exclusively, to be spent later with no network at all. Runs on sign-in and again whenever
// the browser reports the connection back — the two moments when it is worth topping up.
//
// The client-side guess is passed as the floor, so a counter that has never seen these
// records starts above them rather than reissuing numbers already on paper.
useEffect(() => {
  if (!authUid) return undefined;
  const floors = () => ({
    INV: getNextSeqNum(invoicesRaw, 'INV'), EST: getNextSeqNum(invoicesRaw, 'EST'),
    ORD: getNextSeqNum(invoicesRaw, 'ORD'), CN: getNextSeqNum(invoicesRaw, 'CN'),
    REC: getNextSeqNum(paymentsRaw, 'REC'),
  });
  const top = () => { ensureBlocks(floors()).catch(() => {}); };
  top();
  window.addEventListener('online', top);
  return () => window.removeEventListener('online', top);
}, [authUid, invoicesRaw, paymentsRaw]);

// Global keyboard shortcuts — must be BEFORE any conditional return (Rules of Hooks)
useEffect(() => {
  if (!currentUser) return;
  const handler = (e) => {
    // Ctrl+K / Cmd+K is what people try first; Alt+S matches the app's own Alt+B / Alt+C.
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearchModal(true); return; }
    if (e.altKey) {
      if (e.key === 's') { e.preventDefault(); setShowSearchModal(true); return; }
      const map = { d: 'dashboard', i: 'products', b: 'billing', c: 'customers', a: 'admin' };
      if (map[e.key]) { e.preventDefault(); setActiveTab(map[e.key]); }
    }
    if (e.key === 'Escape') {
      // Search sits above everything else it can open, so it closes first.
      if (showSearchModal) setShowSearchModal(false);
      else if (printConfig) setPrintConfig(null);
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
}, [currentUser, showSearchModal, printConfig, showProductModal, showCustomerModal, showPaymentModal, showCreditNoteModal, showLedgerModal, showUserModal, showExpenseCatModal, showSegmentsModal, showRidersModal, billingView]);

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
  <div role="status" className={`font-ui fixed top-6 right-6 lg:left-auto left-1/2 lg:-translate-x-0 -translate-x-1/2 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[100] font-medium text-white flex items-center gap-2.5 text-sm animate-slide-up ${toast.type === 'error' ? 'bg-kt-red' : 'bg-kt-band'}`}>
    {toast.type === 'error' ? <AlertCircle size={18} strokeWidth={1.5} className="shrink-0"/> : <CheckCircle2 size={18} strokeWidth={1.5} className="text-kt-yellow shrink-0"/>}
    {toast.msg}
  </div>
);

// — Auth Screen —
if (!currentUser) {
return (
<div className="font-ui min-h-screen bg-kt-band flex items-center justify-center p-4">
<div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
<div className="text-center mb-8">
<h1 className="font-display text-4xl text-kt-ink">{APP_NAME}</h1>
<p className="text-sm text-kt-sub mt-2">Khyber Traders · customer management</p>
</div>
<form onSubmit={handleLogin} className="space-y-5">
<div>
<label className="text-sm font-medium text-kt-sub">Username</label>
<input type="text" className="w-full h-12 px-4 bg-white border border-kt-line rounded-lg mt-1.5 outline-none focus:border-kt-ink transition-colors text-kt-ink" value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} />
</div>
<div>
<label className="text-sm font-medium text-kt-sub">Password</label>
<input type="password" className="w-full h-12 px-4 bg-white border border-kt-line rounded-lg mt-1.5 outline-none focus:border-kt-ink transition-colors text-kt-ink" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
</div>
{/* Said before the attempt, not after it fails. Signing in is the one thing this app
    genuinely cannot do without a connection, and the login screen is the only place a
    person meets that limit. */}
{sync.state !== 'live' && sync.state !== 'syncing' && (
  <div className="mt-6 bg-kt-amber/10 rounded-lg p-3">
    <p className="text-sm font-medium text-kt-amber">No connection to the server</p>
    <p className="text-sm text-kt-ink mt-1 leading-relaxed">
      Signing in needs the internet — your password is checked on Firebase&apos;s server, not on
      this device, so no password is ever kept here. Nothing you did has been lost: it is
      saved and will sync as soon as you reconnect.
    </p>
  </div>
)}
<button type="submit" disabled={sync.state === 'offline'} className="w-full h-12 bg-kt-primary hover:bg-kt-primary/90 disabled:bg-kt-muted text-white font-medium rounded-lg text-base mt-8 active:scale-[0.98] transition-[background-color,transform]">
  {sync.state === 'offline' ? 'Waiting for a connection…' : 'Sign in'}
</button>
</form>
</div>
{toastEl}
</div>
);
}

// Signing out offline locks you out of your own data.
//
// signOut clears the local session. Signing back in needs getDoc(loginIndex) AND
// signInWithEmailAndPassword, both of which need the network — Firebase Auth verifies a
// password on its own server and cannot do it offline under any configuration. So during an
// outage this one button turns a fully working app, with every customer and invoice cached
// on the device, into a login screen that cannot be got past.
//
// Guarded in the function rather than on the buttons: there are two of them, the sidebar
// and the mobile header, and a third would miss this.
//
// The condition reads the sync state, not just navigator.onLine. onLine is trustworthy in
// one direction only — false means definitely offline, true can still mean a signal that is
// up and carrying nothing — and 'stale' is exactly that case: Firestore serving cache while
// the browser insists all is well. Signing out then is just as much of a lockout.
const logout = async () => {
  if ((sync.state === 'offline' || sync.state === 'stale') && !await showConfirm(
    'There is no connection to the server.\n\nSigning out now means you will NOT be able to sign back in until '
    + 'the internet returns — your password is checked on Firebase\'s server, not on this '
    + 'device.\n\nYour work is saved and will sync by itself. Sign out anyway?')) return;
  try { await signOut(auth); } catch (e) { console.error('Sign-out failed:', e); }
  setCurrentUser(null);
};

// — Main Render —
const ctx = {
isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers,
cities, areas, customerTypes, vehicleTypes,
getPaymentStatus,
showToast, showConfirm, showPrompt, confirmDialog, setConfirmDialog, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData,
voidRecord, restoreRecord, logSave, logDelete, fetchAuditLog, nextDocNumber, invoicesRaw, paymentsRaw, expensesRaw,
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
{/* No font on the root: printed documents and their on-screen previews are siblings of the
    chrome below and keep Inter through the rule in the <style> block. The chrome sets font-ui. */}
<div className="h-screen bg-kt-page text-kt-ink flex flex-row print:hidden">

  {/* ── Desktop Sidebar Navigation (hidden on mobile) ── */}
  <aside className="font-ui hidden lg:flex flex-col w-60 bg-kt-band text-white z-20 shrink-0">
    <div className="px-5 pt-6 pb-5">
      <h1 className="font-display text-2xl leading-none">{APP_NAME}</h1>
      <p className="text-sm text-white/70 mt-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-kt-yellow"></span>{currentUser?.name}</p>
    </div>
    <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      {TABS.map(tab => {
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        // Items is admin-only, so this is only ever seen by someone who can set the cost.
        const costCount = tab.id === 'products' ? productsNeedingCost(products).length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)} title={`Alt+${tab.label[0].toLowerCase()}`}
            aria-current={active ? 'page' : undefined}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
            className={`w-full h-10 flex items-center gap-3 px-3 rounded-lg text-sm transition-colors ${active ? 'bg-kt-yellow text-black font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
            <tab.icon size={18} strokeWidth={1.5} className="shrink-0" />
            <span>{tab.label}</span>
            {/* Counts as quiet numbers at the end of the row, not dots on the icon. */}
            {draftCount > 0 && <span title="Open quotes and draft orders" className={`ml-auto text-xs font-medium tabular-nums px-1.5 h-5 inline-flex items-center rounded ${active ? 'bg-black/10' : 'bg-white/15'}`}>{draftCount}</span>}
            {costCount > 0 && <span title="Products waiting for a cost price" className="ml-auto text-xs font-medium tabular-nums px-1.5 h-5 inline-flex items-center rounded bg-kt-red text-white">{costCount}</span>}
          </button>
        );
      })}
    </nav>
    <div className="px-4 py-4 border-t border-white/15 space-y-3">
      <div className="text-xs text-white/70 space-y-1.5">
        {[['Ctrl', 'K', 'Search'], ['Alt', 'B', 'Billing'], ['Alt', 'C', 'Clients']].map(([a, b, l]) => (
          <div key={l} className="flex items-center gap-2"><kbd className="font-mono text-[11px] px-1.5 rounded bg-white/10 border border-white/15">{a}+{b}</kbd>{l}</div>
        ))}
      </div>
      <button onClick={logout} className="w-full h-9 text-sm text-white/80 border border-white/20 rounded-lg hover:bg-white/10 hover:text-white transition-colors">Log out</button>
    </div>
  </aside>

  {/* ── Main content area ── */}
  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
    {/* Mobile/tablet header */}
    <header className="font-ui lg:hidden bg-kt-band text-white px-4 py-3 flex justify-between items-center z-10 sticky top-0">
      <div className="min-w-0">
        <h1 className="font-display text-xl min-[380px]:text-2xl leading-none">{APP_NAME}</h1>
        <p className="text-sm text-white/70 mt-1 flex items-center gap-2 truncate"><span className="w-1.5 h-1.5 rounded-full bg-kt-yellow shrink-0"></span>{currentUser?.name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SyncPill />
        <button onClick={() => setShowSearchModal(true)} aria-label="Search everything" title="Search everything" className="w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"><Search size={18} strokeWidth={1.5}/></button>
        <button onClick={logout} className="h-9 px-3 text-sm text-white/80 border border-white/20 rounded-lg hover:bg-white/10 hover:text-white transition-colors">Log out</button>
      </div>
    </header>

    {/* Desktop top bar */}
    <header className="font-ui hidden lg:flex bg-white border-b border-kt-line px-6 h-16 items-center justify-between z-10">
      <div className="flex flex-1 items-center gap-5 min-w-0">
        <h2 className="font-display text-2xl text-kt-ink capitalize shrink-0">{TABS.find(t=>t.id===activeTab)?.label || ''}</h2>
        <button
          onClick={() => setShowSearchModal(true)}
          aria-label="Search everything"
          className="flex items-center gap-2 w-full max-w-80 min-w-0 h-9 px-3 bg-kt-page border border-kt-line rounded-lg text-kt-muted hover:border-kt-muted/50 transition-colors"
        >
          <Search size={16} strokeWidth={1.5} className="shrink-0"/>
          <span className="text-sm truncate">Customers, invoice numbers, products</span>
          <kbd className="ml-auto text-[11px] text-kt-sub bg-white border border-kt-line px-1.5 rounded font-mono shrink-0">Ctrl+K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-3">
        {activeTab === 'billing' && billingView === 'list' && (
          <button onClick={() => { setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' }); setBillingView('form'); }} className="h-9 flex items-center gap-2 bg-kt-primary text-white px-4 rounded-lg text-sm font-medium hover:bg-kt-primary/90 transition-colors"><Plus size={16} strokeWidth={1.5}/> New invoice <kbd className="text-[11px] bg-white/15 px-1.5 rounded font-mono">Alt+B</kbd></button>
        )}
        {activeTab === 'customers' && hasPermission('receivePayments') && (
          <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="h-9 flex items-center gap-2 bg-kt-primary text-white px-4 rounded-lg text-sm font-medium hover:bg-kt-primary/90 transition-colors"><Wallet size={16} strokeWidth={1.5}/> Receive payment</button>
        )}
        <SyncPill />
        <span className="text-xs text-kt-muted flex items-center gap-1.5"><kbd className="font-mono text-[11px] text-kt-sub px-1.5 rounded border border-kt-line">Esc</kbd>back or close</span>
      </div>
    </header>

    <main className="font-ui flex-1 overflow-hidden h-full bg-kt-page">
      <div className="relative h-full lg:max-w-4xl lg:mx-auto lg:my-0 bg-kt-page overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'admin' && <AdminTab />}
      </div>
    </main>

    {/* Mobile bottom nav */}
    <nav aria-label="Main" className="font-ui lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-kt-line flex items-center justify-between pb-6 pt-2 px-1 z-10">
      {TABS.map(tab => {
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        // Items is admin-only, so this is only ever seen by someone who can set the cost.
        const costCount = tab.id === 'products' ? productsNeedingCost(products).length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)}
            aria-current={active ? 'page' : undefined}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
            className={`flex flex-col items-center justify-center w-full min-h-[52px] transition-colors ${active ? 'text-kt-ink' : 'text-kt-muted'}`}>
            <div className={`relative px-4 py-1 rounded-full transition-colors ${active ? 'bg-kt-yellow' : ''}`}>
              <tab.icon size={22} strokeWidth={1.5} />
              {draftCount > 0 && <span className="absolute -top-1 right-1 bg-kt-amber text-white text-[10px] font-medium min-w-4 h-4 px-1 rounded-full flex items-center justify-center leading-none tabular-nums">{draftCount > 9 ? '9+' : draftCount}</span>}{costCount > 0 && <span title="Products waiting for a cost price" className="absolute -top-1 right-1 bg-kt-red text-white text-[10px] font-medium min-w-4 h-4 px-1 rounded-full flex items-center justify-center leading-none tabular-nums">{costCount > 9 ? '9+' : costCount}</span>}
            </div>
            <span className={`text-xs mt-1 ${active ? 'font-medium' : ''}`}>{tab.label}</span>
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
  {showSearchModal && <GlobalSearchModal onClose={() => setShowSearchModal(false)} />}
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
    *:not(.font-ui, .font-ui *, .font-doc, .font-doc *) { font-family: 'Inter', system-ui, sans-serif; }
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