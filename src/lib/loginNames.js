// How a username becomes a login address.
//
// Pure, and in its own module rather than in firebase.js, because firebase.js initialises
// Auth at import time and throws without credentials — anything importing it is unreachable
// from a test, and unreachable from any component that wants to be tested.
//
// Three records must agree on the result of this function: the app_users profile, the
// userRoles mirror the rules read, and the public loginIndex the login screen resolves
// against before anyone is signed in. See docs/SECURITY_CUTOVER.md.
export const loginSlug = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'user';

export const authEmailFor = (name) => `${loginSlug(name)}@animalhealthpk.app`;
