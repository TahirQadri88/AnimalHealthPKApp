// How much of the screen the on-screen keyboard covers, in CSS pixels, or 0.
// visualViewport shrinks when the keyboard opens; the layout viewport (innerHeight) does not
// on iOS and does on Android, so the gap between them is the keyboard on iOS and about zero
// on Android, where the page itself already got shorter. Either way a large gap means typing.
export const keyboardInset = (win) => {
  const vv = win?.visualViewport;
  if (!vv || !win.innerHeight) return 0;
  const gap = win.innerHeight - vv.height - (vv.offsetTop || 0);
  return gap > 0 ? Math.round(gap) : 0;
};

// Android resizes the page instead, so a field focused on a short, touch-only screen is the
// other signal. Desktop never counts: a physical keyboard does not cover anything.
export const softKeyboardOpen = (win, doc) => {
  if (!win || !doc) return false;
  const coarse = !!win.matchMedia?.('(pointer: coarse)')?.matches;
  if (!coarse) return false;
  if (keyboardInset(win) > 120) return true;
  const el = doc.activeElement;
  const typing = !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'date'].includes(el.type)));
  const full = win.screen?.height || 0;
  return typing && full > 0 && win.innerHeight < full * 0.62;
};
