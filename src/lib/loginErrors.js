// What to tell someone whose sign-in did not work.
//
// The login screen had a two-way branch: "Too many attempts" for auth/too-many-requests and
// "Invalid Credentials" for absolutely everything else. Offline, Firebase Auth fails with
// auth/network-request-failed — so the app told a person with a perfectly good password
// that their credentials were wrong.
//
// That is a bad thing to tell someone about their own account. It invites them to try again,
// then doubt the password they have used for months, then ask for a reset — none of which
// helps, because the only thing wrong is that there is no connection. Reported 2026-09-04
// after signing out during an outage.
//
// Firebase Auth cannot verify a password offline under any configuration: the check happens
// on Google's servers. So the honest message says that, says the data is still on the device,
// and says what to do about it.

export const NETWORK_CODES = [
  'auth/network-request-failed',
  'auth/timeout',
  'unavailable',
  'deadline-exceeded',
];

export const WRONG_CREDENTIAL_CODES = [
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/invalid-email',
];

export const isNetworkError = (code) => NETWORK_CODES.includes(String(code || ''));

// Wording matters here. An earlier draft said "everything you had is still saved here",
// which was meant as "nothing is lost" and was read as "your data is lying around on this
// device" — a fair question to ask, and the wrong impression to leave. It says what is
// true and reassuring without implying an exposure: no password is kept on the device at
// all, which is exactly why this cannot be checked offline.
export const OFFLINE_MESSAGE =
  'No connection — cannot sign in. Your password is checked on Firebase\'s server, not on '
  + 'this device, so none is kept here. Nothing you did has been lost; reconnect and sign in '
  + 'to carry on.';

/**
 * @param {string} code    the Firebase error code
 * @param {boolean} online whether the browser believes it has a connection
 */
export const signInErrorMessage = (code, { online = true } = {}) => {
  if (isNetworkError(code)) return OFFLINE_MESSAGE;
  // The browser knowing it is offline outranks any code Firebase produced on the way.
  if (!online) return OFFLINE_MESSAGE;
  if (code === 'auth/too-many-requests') return 'Too many attempts — wait a minute and try again';
  if (code === 'auth/user-disabled') return 'This account has been disabled';
  if (WRONG_CREDENTIAL_CODES.includes(String(code || ''))) return 'Invalid Credentials';
  // Anything unrecognised: do not claim to know it was the password.
  return 'Could not sign in — please try again';
};
