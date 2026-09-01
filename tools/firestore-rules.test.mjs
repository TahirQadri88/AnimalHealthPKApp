// firestore.rules, executed rather than reasoned about.
//
// This file is the only thing standing between a rules edit and locking three people out
// of their own business data. Run it with `npm run test:rules`, which starts the Firestore
// emulator around it — it is deliberately NOT part of `npm run verify`, because it needs
// a JVM and a downloaded emulator jar.
//
// The cast mirrors the real deployment: two admins, one staff member, plus the two states
// that must fail — a disabled account and a signed-out visitor.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

let env;

const ADMIN = { uid: 'uid-admin', appUserId: 1 };
const STAFF = { uid: 'uid-staff', appUserId: 2 };   // every granular permission granted
const BARE  = { uid: 'uid-bare',  appUserId: 3 };   // active, but no permissions at all
const OFF   = { uid: 'uid-off',   appUserId: 4 };   // deactivated

const ALL_PERMS = {
  viewAllInvoices: true, viewDashboard: true, viewCustomers: true, receivePayments: true,
  collectOnBill: true, editOwnInvoices: true, issueInvoices: true, salesReturns: true,
  viewLedger: true, addCustomers: true, addEditProducts: true,
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { if (env) await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'userRoles', ADMIN.uid), { uid: ADMIN.uid, appUserId: ADMIN.appUserId, name: 'Owner', role: 'admin', permissions: {}, active: true });
    await setDoc(doc(db, 'userRoles', STAFF.uid), { uid: STAFF.uid, appUserId: STAFF.appUserId, name: 'Ghousia', role: 'staff', permissions: ALL_PERMS, active: true });
    await setDoc(doc(db, 'userRoles', BARE.uid),  { uid: BARE.uid,  appUserId: BARE.appUserId,  name: 'Bare',    role: 'staff', permissions: {}, active: true });
    await setDoc(doc(db, 'userRoles', OFF.uid),   { uid: OFF.uid,   appUserId: OFF.appUserId,   name: 'Former',  role: 'staff', permissions: ALL_PERMS, active: false });
    // Seed one of everything the tests act on.
    await setDoc(doc(db, 'invoices', 'INV-1'), { id: 'INV-1', status: 'Billed', customerId: 9, total: 1000, salespersonId: STAFF.appUserId });
    await setDoc(doc(db, 'invoices', 'INV-2'), { id: 'INV-2', status: 'Billed', customerId: 9, total: 2000, salespersonId: ADMIN.appUserId });
    await setDoc(doc(db, 'invoices', 'EST-1'), { id: 'EST-1', status: 'Estimate', customerId: 9, total: 500, salespersonId: STAFF.appUserId });
    await setDoc(doc(db, 'invoices', 'CN-1'),  { id: 'CN-1', status: 'CreditNote', customerId: 9, total: 300, salespersonId: STAFF.appUserId });
    await setDoc(doc(db, 'payments', 'REC-1'), { id: 'REC-1', customerId: 9, amount: 500 });
    await setDoc(doc(db, 'expenses', '1'), { id: 1, amount: 100, category: 'Transport' });
    await setDoc(doc(db, 'customers', '9'), { id: 9, name: 'Abdul Qadir' });
    await setDoc(doc(db, 'products', '5'), { id: 5, name: 'Antox 9', costPrice: 100 });
    await setDoc(doc(db, 'counters', 'INV'), { prefix: 'INV', next: 10 });
    await setDoc(doc(db, 'appSettings', 'main'), { id: 'main', businessName: 'Khyber Traders' });
  });
});

const as = (user) => env.authenticatedContext(user.uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// ── The floor: things that must NEVER work ──────────────────────────────────
describe('signed out', () => {
  it('can resolve a username at the login screen, and nothing else', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'loginIndex', 'ghousia')));
    await assertFails(getDocs(collection(anon(), 'invoices')));
    await assertFails(getDoc(doc(anon(), 'customers', '9')));
    await assertFails(setDoc(doc(anon(), 'invoices', 'INV-9'), { total: 1 }));
  });
});

describe('a deactivated account', () => {
  it('keeps its login and loses everything else', async () => {
    await assertFails(getDocs(collection(as(OFF), 'invoices')));
    await assertFails(setDoc(doc(as(OFF), 'payments', 'REC-9'), { amount: 1 }));
    await assertFails(getDoc(doc(as(OFF), 'appSettings', 'main')));
  });
});

describe('nobody rewrites history or their own role', () => {
  it('audit entries can be added but never changed or removed', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'auditLogs', 'a1'), { action: 'create', at: '2026-09-01' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'auditLogs', 'a2'), { action: 'void' });
    });
    await assertFails(updateDoc(doc(as(ADMIN), 'auditLogs', 'a2'), { action: 'create' }));
    await assertFails(deleteDoc(doc(as(ADMIN), 'auditLogs', 'a2')));
  });

  it('only an admin reads the log', async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), 'auditLogs')));
    await assertFails(getDocs(collection(as(STAFF), 'auditLogs')));
  });

  it('a staff member cannot promote themselves', async () => {
    await assertFails(setDoc(doc(as(STAFF), 'userRoles', STAFF.uid), { role: 'admin', active: true, permissions: {} }));
    await assertFails(setDoc(doc(as(BARE), 'userRoles', BARE.uid), { role: 'admin', active: true, permissions: {} }));
  });

  it('a counter never runs backwards', async () => {
    await assertSucceeds(updateDoc(doc(as(STAFF), 'counters', 'INV'), { next: 11 }));
    await assertFails(updateDoc(doc(as(STAFF), 'counters', 'INV'), { next: 5 }));
  });
});

// ── The job: what an active user must always be able to do ──────────────────
describe('an active user can do the job', () => {
  it('reads the collections the screens need', async () => {
    for (const c of ['invoices', 'payments', 'expenses', 'customers', 'products', 'appSettings']) {
      await assertSucceeds(getDocs(collection(as(BARE), c)));
    }
  });

  it('raises an invoice and claims its number', async () => {
    await assertSucceeds(setDoc(doc(as(BARE), 'invoices', 'INV-9'), { id: 'INV-9', status: 'Billed', total: 100, salespersonId: BARE.appUserId }));
    await assertSucceeds(updateDoc(doc(as(BARE), 'counters', 'INV'), { next: 12 }));
  });

  it('never deletes a financial record — that is what voiding replaced', async () => {
    await assertFails(deleteDoc(doc(as(STAFF), 'invoices', 'INV-1')));
    await assertFails(deleteDoc(doc(as(STAFF), 'payments', 'REC-1')));
  });
});

// ── The gap being closed ────────────────────────────────────────────────────
describe('granular permissions', () => {
  it('receivePayments gates writing a payment', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'payments', 'REC-9'), { id: 'REC-9', customerId: 9, amount: 100 }));
    await assertFails(setDoc(doc(as(BARE), 'payments', 'REC-8'), { id: 'REC-8', customerId: 9, amount: 100 }));
  });

  it('addCustomers gates creating a customer', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'customers', '11'), { id: 11, name: 'New Client' }));
    await assertFails(setDoc(doc(as(BARE), 'customers', '12'), { id: 12, name: 'New Client' }));
  });

  it('addEditProducts gates writing a product', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'products', '6'), { id: 6, name: 'New Item' }));
    await assertFails(setDoc(doc(as(BARE), 'products', '7'), { id: 7, name: 'New Item' }));
  });

  it('salesReturns gates raising a credit note', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'invoices', 'CN-9'), { id: 'CN-9', status: 'CreditNote', total: 50, salespersonId: STAFF.appUserId }));
    await assertFails(setDoc(doc(as(BARE), 'invoices', 'CN-8'), { id: 'CN-8', status: 'CreditNote', total: 50, salespersonId: BARE.appUserId }));
  });

  it('editOwnInvoices means OWN — not a colleague’s', async () => {
    await assertSucceeds(updateDoc(doc(as(STAFF), 'invoices', 'INV-1'), { total: 1500 }));
    await assertFails(updateDoc(doc(as(STAFF), 'invoices', 'INV-2'), { total: 1500 }));
    await assertFails(updateDoc(doc(as(BARE), 'invoices', 'INV-1'), { total: 1500 }));
  });

  it('an admin is not bound by any of it', async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), 'payments', 'REC-7'), { id: 'REC-7', amount: 1 }));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'products', '8'), { id: 8, name: 'x' }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'invoices', 'INV-1'), { total: 9 }));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'invoices', 'CN-7'), { id: 'CN-7', status: 'CreditNote', total: 1 }));
  });

  it('a missing permissions map denies rather than erroring the whole rule', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      // A role document written before permissions existed at all.
      await setDoc(doc(ctx.firestore(), 'userRoles', 'uid-legacy'), { uid: 'uid-legacy', appUserId: 5, role: 'staff', active: true });
    });
    const legacy = env.authenticatedContext('uid-legacy').firestore();
    await assertSucceeds(getDocs(collection(legacy, 'invoices')));            // still works
    await assertFails(setDoc(doc(legacy, 'payments', 'REC-6'), { amount: 1 })); // but gated
  });
});

// ── Behaviours introduced when the permissions were wired in ────────────────
describe('issuing a draft', () => {
  it('issueInvoices may remove the draft it just converted', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'invoices', 'INV-20'), { id: 'INV-20', status: 'Billed', total: 500, salespersonId: STAFF.appUserId }));
    await assertSucceeds(deleteDoc(doc(as(STAFF), 'invoices', 'EST-1')));
  });

  it('but never a billed invoice or a credit note — those are voided', async () => {
    await assertFails(deleteDoc(doc(as(STAFF), 'invoices', 'INV-1')));
    await assertFails(deleteDoc(doc(as(STAFF), 'invoices', 'CN-1')));
  });

  it('and not at all without the permission', async () => {
    await assertFails(deleteDoc(doc(as(BARE), 'invoices', 'EST-1')));
  });
});

describe('collectOnBill gates cash taken at the counter', () => {
  it('a bill with no cash needs no permission', async () => {
    await assertSucceeds(setDoc(doc(as(BARE), 'invoices', 'INV-21'), { id: 'INV-21', status: 'Billed', total: 100, receivedAmount: 0, salespersonId: BARE.appUserId }));
  });
  it('a bill recording cash does', async () => {
    await assertFails(setDoc(doc(as(BARE), 'invoices', 'INV-22'), { id: 'INV-22', status: 'Billed', total: 100, receivedAmount: 100, salespersonId: BARE.appUserId }));
    await assertSucceeds(setDoc(doc(as(STAFF), 'invoices', 'INV-23'), { id: 'INV-23', status: 'Billed', total: 100, receivedAmount: 100, salespersonId: STAFF.appUserId }));
  });
});

describe('voiding through the rules', () => {
  it('an admin may void anything', async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'invoices', 'INV-1'), { voided: true, voidReason: 'Duplicate' }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'payments', 'REC-1'), { voided: true, voidReason: 'Wrong client' }));
  });

  it('a staff member cannot void a colleague’s invoice', async () => {
    await assertFails(updateDoc(doc(as(STAFF), 'invoices', 'INV-2'), { voided: true, voidReason: 'nope' }));
  });

  it('and cannot void a payment without receivePayments', async () => {
    await assertFails(updateDoc(doc(as(BARE), 'payments', 'REC-1'), { voided: true }));
  });
});

describe('master data', () => {
  it('addCustomers covers correcting a client as well as adding one', async () => {
    await assertSucceeds(updateDoc(doc(as(STAFF), 'customers', '9'), { phone: '0300-1111111' }));
    await assertFails(updateDoc(doc(as(BARE), 'customers', '9'), { phone: '0300-2222222' }));
  });

  it('deleting a client or a product stays with admins', async () => {
    await assertFails(deleteDoc(doc(as(STAFF), 'customers', '9')));
    await assertFails(deleteDoc(doc(as(STAFF), 'products', '5')));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), 'products', '5')));
  });

  it('registries every biller touches stay open to active users', async () => {
    await assertSucceeds(setDoc(doc(as(BARE), 'riders', 'r1'), { id: 'r1', name: 'Ali' }));
    await assertSucceeds(setDoc(doc(as(BARE), 'transportCompanies', 't1'), { id: 't1', name: 'Daewoo' }));
    await assertFails(setDoc(doc(as(BARE), 'vehicleTypes', 'v1'), { id: 'v1', name: 'Truck' }));
    await assertFails(setDoc(doc(as(BARE), 'appSettings', 'main'), { businessName: 'Hijacked' }));
  });
});
