import { describe, it, expect } from 'vitest';
import { signInErrorMessage, isNetworkError, OFFLINE_MESSAGE } from './loginErrors';

describe('signInErrorMessage', () => {
  // The report that prompted this: signed out during an outage, then told the password was
  // wrong. Firebase Auth cannot verify a password offline under any configuration.
  it('tells the truth about a network failure instead of blaming the password', () => {
    expect(signInErrorMessage('auth/network-request-failed')).toBe(OFFLINE_MESSAGE);
    expect(signInErrorMessage('auth/network-request-failed')).not.toContain('Invalid');
  });

  it('says where the data went, because it has not gone anywhere', () => {
    expect(OFFLINE_MESSAGE).toContain('saved data is still here');
  });

  it('says what to do about it', () => {
    expect(OFFLINE_MESSAGE).toContain('connect to the internet');
  });

  // Whatever code Firebase produced on the way, the browser knowing it is offline is the
  // more useful fact.
  it('reports offline whenever the browser is offline, whatever the code', () => {
    expect(signInErrorMessage('auth/invalid-credential', { online: false })).toBe(OFFLINE_MESSAGE);
    expect(signInErrorMessage(undefined, { online: false })).toBe(OFFLINE_MESSAGE);
  });

  it('still says the password is wrong when it is', () => {
    ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials']
      .forEach(code => expect(signInErrorMessage(code)).toBe('Invalid Credentials'));
  });

  it('keeps the messages that were already right', () => {
    expect(signInErrorMessage('auth/too-many-requests')).toMatch(/Too many attempts/);
    expect(signInErrorMessage('auth/user-disabled')).toMatch(/disabled/);
  });

  // The old code said "Invalid Credentials" for anything it did not recognise, which is a
  // claim it had no basis for.
  it('does not blame the password for something it does not recognise', () => {
    expect(signInErrorMessage('auth/internal-error')).toBe('Could not sign in — please try again');
    expect(signInErrorMessage(undefined)).toBe('Could not sign in — please try again');
    expect(signInErrorMessage('')).toBe('Could not sign in — please try again');
  });
});

describe('isNetworkError', () => {
  it('knows the codes Firebase uses when it cannot reach the server', () => {
    expect(isNetworkError('auth/network-request-failed')).toBe(true);
    expect(isNetworkError('unavailable')).toBe(true);
  });

  it('is false for a real credential failure, and for nothing at all', () => {
    expect(isNetworkError('auth/wrong-password')).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});
