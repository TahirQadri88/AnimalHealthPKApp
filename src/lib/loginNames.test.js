import { describe, it, expect } from 'vitest';
import { loginSlug, authEmailFor } from './loginNames';

// Three records must agree on this value — app_users, the userRoles mirror the rules read,
// and the public loginIndex the login screen resolves against before anyone is signed in.
// A change here locks people out, which is why it is pinned rather than left to inspection.
describe('loginSlug', () => {
  it('lowercases and joins on dots', () => {
    expect(loginSlug('Ali Raza')).toBe('ali.raza');
    expect(loginSlug('GHOUSIA')).toBe('ghousia');
  });

  it('collapses runs of punctuation into a single dot', () => {
    expect(loginSlug('Ali   Raza')).toBe('ali.raza');
    expect(loginSlug("O'Brien & Sons")).toBe('o.brien.sons');
  });

  it('trims dots from the ends', () => {
    expect(loginSlug('  Ali Raza  ')).toBe('ali.raza');
    expect(loginSlug('!!!Ali!!!')).toBe('ali');
  });

  it('handles the real accounts, which are email addresses', () => {
    expect(loginSlug('animalhealthpk@gmail.com')).toBe('animalhealthpk.gmail.com');
    expect(loginSlug('owais797@icloud.com')).toBe('owais797.icloud.com');
    expect(loginSlug('ghousia.qadri@gmail.com')).toBe('ghousia.qadri.gmail.com');
  });

  // Never an empty string: an empty slug would be a loginIndex key of '', which every
  // blank-named account would then share.
  it('falls back to "user" rather than returning nothing', () => {
    expect(loginSlug('')).toBe('user');
    expect(loginSlug('   ')).toBe('user');
    expect(loginSlug('!!!')).toBe('user');
    expect(loginSlug(undefined)).toBe('user');
    expect(loginSlug(null)).toBe('user');
  });
});

describe('authEmailFor', () => {
  it('builds the synthetic address Firebase Auth signs in with', () => {
    expect(authEmailFor('Ali Raza')).toBe('ali.raza@animalhealthpk.app');
    expect(authEmailFor('animalhealthpk@gmail.com')).toBe('animalhealthpk.gmail.com@animalhealthpk.app');
  });

  it('is always a valid-looking address, even for nothing', () => {
    expect(authEmailFor('')).toBe('user@animalhealthpk.app');
  });
});
