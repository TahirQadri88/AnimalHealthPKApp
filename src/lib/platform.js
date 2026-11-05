// Is this an iPhone or iPad, however Safari is presenting itself?
//
// Print and PDF take a different route on iOS (a PDF handed to the share sheet): a page cannot reliably open
// the print sheet there, and Safari's own print adds the page address in a footer. The first version looked
// only at the browser's identity string, and an iPhone showing "Request Desktop Website" (or running the
// home-screen app) can present itself as a Mac, so the app took the print-window route and Safari printed it
// with its footer. So every signal counts: the identity string, the platform, an iPad posing as a Mac (it has
// a touch screen, a Mac does not), and the home-screen app flag, which only iOS sets.
export const isIOS = (nav) => {
  if (!nav) return false;
  const ua = String(nav.userAgent || '');
  const platform = String(nav.platform || '');
  const touch = Number(nav.maxTouchPoints || 0);
  return /iPhone|iPad|iPod/.test(ua)
    || /iPhone|iPad|iPod/.test(platform)
    || (platform === 'MacIntel' && touch > 1)
    || (/Macintosh|Mac OS X/.test(ua) && touch > 1)
    || nav.standalone === true;
};
