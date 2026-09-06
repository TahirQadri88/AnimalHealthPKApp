// Installing the app to the home screen, which is how the browser is persuaded to keep the
// offline cache.
//
// navigator.storage.persist() is a request, and Chrome refuses it for an ordinary tab. Its
// heuristics grant it to a site that is INSTALLED, or has high engagement, or holds
// notification permission. Installing is the one a person can actually do on purpose — and
// on 2026-09-04 the readiness panel reported the refusal on a real device, with the advice
// "installing usually earns this" and no way to act on it.
//
// So the advice becomes a button. Chrome and Edge fire `beforeinstallprompt`, which must be
// captured and held: it can only be used once, and only in response to a gesture. iOS Safari
// fires nothing and has no API at all — there the only honest thing is to say where the menu
// item is.
//
// The detection is pure and exported separately so it can be tested without a browser.

let deferred = null;
const listeners = new Set();

const notify = () => listeners.forEach(fn => { try { fn(); } catch { /* one bad listener must not stop the rest */ } });

/** Start listening. Call once, at start-up. Returns a cleanup function. */
export const captureInstallPrompt = (target = globalThis.window) => {
  if (!target?.addEventListener) return () => {};
  const onPrompt = (e) => {
    // Without this the browser shows its own bar and never gives us the event to re-use.
    e.preventDefault();
    deferred = e;
    notify();
  };
  const onInstalled = () => { deferred = null; notify(); };
  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
  };
};

export const subscribeInstallPrompt = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const hasInstallPrompt = () => deferred !== null;

/** Show the browser's install dialog. Resolves what the person chose, or null. */
export const promptInstall = async () => {
  if (!deferred) return null;
  const event = deferred;
  // A captured prompt is single-use whatever the answer, so let it go either way.
  deferred = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome ?? null;
  } catch {
    return null;
  }
};

export const isStandalone = (win = globalThis.window, nav = globalThis.navigator) => {
  try {
    if (win?.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    // iOS Safari's own, non-standard flag — the only signal available there.
    return nav?.standalone === true;
  } catch {
    return false;
  }
};

export const isIOS = (ua = globalThis.navigator?.userAgent || '') =>
  /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ reports itself as a Mac; a touch-capable one is an iPad.
  || (/Macintosh/.test(ua) && (globalThis.navigator?.maxTouchPoints || 0) > 1);

/**
 * What to offer, given what the platform allows. Pure.
 * @returns {{ mode: 'installed'|'prompt'|'ios'|'unavailable', text: string }}
 */
export const installAdvice = ({ standalone, canPrompt, ios } = {}) => {
  if (standalone) {
    return { mode: 'installed', text: 'Installed on this device — the browser is far more likely to keep your offline data.' };
  }
  if (canPrompt) {
    return { mode: 'prompt', text: 'Install the app to this device. Browsers keep the offline cache for an installed app and clear it for an ordinary tab.' };
  }
  if (ios) {
    return { mode: 'ios', text: 'In Safari, tap Share and then “Add to Home Screen”. An installed app keeps its offline data; a browser tab may have it cleared.' };
  }
  return {
    mode: 'unavailable',
    text: 'Use your browser’s menu to install this app or add it to the home screen — an installed app keeps its offline data.',
  };
};

/** Test seam. */
export const __resetInstallPrompt = () => { deferred = null; listeners.clear(); };
