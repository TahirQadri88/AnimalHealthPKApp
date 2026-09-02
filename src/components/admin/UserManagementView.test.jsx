// Purity of the move: node tools/extraction-diff.mjs UserManagementView src/components/admin/UserManagementView.jsx
//
// This screen sits on top of the three-records rule — app_users, the userRoles mirror the
// rules read, and the public loginIndex. It was moved, not refactored, for that reason.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { UserManagementView } from './UserManagementView';

const USERS = [
  { id: 1, name: 'animalhealthpk@gmail.com', role: 'admin', active: true, authUid: 'uid-a' },
  { id: 2, name: 'owais797@icloud.com', role: 'admin', active: true, authUid: 'uid-b' },
  { id: 3, name: 'ghousia.qadri@gmail.com', role: 'staff', active: true, authUid: 'uid-c', permissions: { receivePayments: true } },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    appUsers: USERS, invoices: [], currentUser: USERS[0], isAdmin: true,
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, setEditingUser: () => {}, setShowUserModal: () => {},
    migrateUsersToAuth: async () => ({ ok: true }), ...over,
  }}>
    <UserManagementView />
  </AppContext.Provider>
);

describe('UserManagementView', () => {
  it('lists the team', () => {
    const html = render();
    expect(html).toContain('animalhealthpk@gmail.com');
    expect(html).toContain('ghousia.qadri@gmail.com');
  });

  it('counts them', () => {
    expect(render()).toContain('3 users registered');
  });

  it('shows that every account is on Firebase Authentication', () => {
    // The banner that says no passwords are stored in the database — worth pinning, since
    // it is the visible claim that the security cutover is complete.
    expect(render()).toContain('use Firebase Authentication');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an account with no permissions map — role documents predate every permission', () => {
    const legacy = [{ id: 9, name: 'Old Account', role: 'staff', active: true, authUid: 'uid-x' }];
    expect(() => render({ appUsers: legacy })).not.toThrow();
    expect(render({ appUsers: legacy })).not.toMatch(/undefined|NaN/);
  });
});
