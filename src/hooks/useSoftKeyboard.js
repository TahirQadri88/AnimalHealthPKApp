import { useEffect, useState } from 'react';
import { softKeyboardOpen } from '../lib/softKeyboard';

// True while the phone's on-screen keyboard is up. Always false on a desktop, and when the
// browser offers no way to tell (no visualViewport), which leaves the screen as it was.
export const useSoftKeyboard = (active = true) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const check = () => setOpen(softKeyboardOpen(window, document));
    const vv = window.visualViewport;
    vv?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    check();
    return () => {
      vv?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
      setOpen(false);
    };
  }, [active]);
  return open;
};
