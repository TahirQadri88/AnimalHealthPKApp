import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureInstallPrompt, subscribeInstallPrompt, hasInstallPrompt, promptInstall,
  isStandalone, isIOS, installAdvice, __resetInstallPrompt,
} from './installPrompt';

beforeEach(() => __resetInstallPrompt());

// A stand-in for window that lets a test fire the event.
const fakeWindow = () => {
  const handlers = {};
  return {
    addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); },
    removeEventListener: (name, fn) => { handlers[name] = (handlers[name] || []).filter(f => f !== fn); },
    fire: (name, e) => (handlers[name] || []).forEach(fn => fn(e)),
    count: (name) => (handlers[name] || []).length,
  };
};
const promptEvent = (outcome = 'accepted') => ({
  preventDefault: vi.fn(),
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome }),
});

describe('capturing the prompt', () => {
  it('holds the event so it can be used later, on a gesture', () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    expect(hasInstallPrompt()).toBe(false);
    win.fire('beforeinstallprompt', promptEvent());
    expect(hasInstallPrompt()).toBe(true);
  });

  // Without preventDefault the browser shows its own bar and never hands the event back.
  it('stops the browser showing its own bar', () => {
    const win = fakeWindow();
    const e = promptEvent();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('tells subscribers there is something to offer', () => {
    const win = fakeWindow();
    const fn = vi.fn();
    captureInstallPrompt(win);
    subscribeInstallPrompt(fn);
    win.fire('beforeinstallprompt', promptEvent());
    expect(fn).toHaveBeenCalled();
  });

  it('forgets it once the app has been installed', () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', promptEvent());
    win.fire('appinstalled', {});
    expect(hasInstallPrompt()).toBe(false);
  });

  it('cleans up after itself', () => {
    const win = fakeWindow();
    captureInstallPrompt(win)();
    expect(win.count('beforeinstallprompt')).toBe(0);
    expect(win.count('appinstalled')).toBe(0);
  });

  it('does nothing at all where there is no window', () => {
    expect(() => captureInstallPrompt(undefined)()).not.toThrow();
  });
});

describe('showing the prompt', () => {
  it('reports what the person chose', async () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', promptEvent('accepted'));
    expect(await promptInstall()).toBe('accepted');
  });

  it('reports a refusal as a refusal', async () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', promptEvent('dismissed'));
    expect(await promptInstall()).toBe('dismissed');
  });

  // The captured event is single-use whatever the answer, so offering it twice would show
  // a button that does nothing.
  it('is spent after one use, accepted or not', async () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', promptEvent('dismissed'));
    await promptInstall();
    expect(hasInstallPrompt()).toBe(false);
    expect(await promptInstall()).toBeNull();
  });

  it('is null when there was never anything to show', async () => {
    expect(await promptInstall()).toBeNull();
  });

  it('does not throw when the browser refuses to show it', async () => {
    const win = fakeWindow();
    captureInstallPrompt(win);
    win.fire('beforeinstallprompt', { preventDefault: vi.fn(), prompt: () => { throw new Error('no'); } });
    await expect(promptInstall()).resolves.toBeNull();
  });
});

describe('detecting the platform', () => {
  it('knows an installed app from a tab', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }) }, {})).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }) }, {})).toBe(false);
  });

  it('reads iOS Safari\'s own non-standard flag, which is all it offers', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }) }, { standalone: true })).toBe(true);
  });

  it('does not throw in an environment with neither', () => {
    expect(isStandalone(undefined, undefined)).toBe(false);
    expect(isStandalone({ matchMedia: () => { throw new Error('x'); } }, {})).toBe(false);
  });

  it('spots an iPhone and an iPad', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('is false for Android and for a desktop', () => {
    expect(isIOS('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
    expect(isIOS('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
  });
});

// The panel must offer the right thing, and never a button the platform cannot honour.
describe('installAdvice', () => {
  it('says nothing to do when it is already installed', () => {
    expect(installAdvice({ standalone: true, canPrompt: true, ios: false }).mode).toBe('installed');
  });

  it('offers the button where the browser gave us one', () => {
    const a = installAdvice({ standalone: false, canPrompt: true, ios: false });
    expect(a.mode).toBe('prompt');
    expect(a.text).toMatch(/clear it for an ordinary tab/);
  });

  // iOS fires no event and has no API, so the only honest answer is where the menu item is.
  it('gives iOS the menu path instead of a button that cannot work', () => {
    const a = installAdvice({ standalone: false, canPrompt: false, ios: true });
    expect(a.mode).toBe('ios');
    expect(a.text).toMatch(/Add to Home Screen/);
  });

  it('falls back to the browser menu when it cannot tell', () => {
    expect(installAdvice({}).mode).toBe('unavailable');
    expect(installAdvice().mode).toBe('unavailable');
  });
});
