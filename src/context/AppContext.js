import { createContext, useContext } from 'react';

// The one context every screen reads. It lives here, and not in App.jsx, for a reason that
// only shows up once components start moving out into their own files: a component that
// imported this from App.jsx would create an import cycle, and ESM answers a cycle with a
// binding that is still `undefined` at module-initialisation time. That is a blank page
// before React renders, and neither `npm run lint` nor `npm run lint:scope` would report
// it. Nothing extracted from App.jsx may import from App.jsx — see docs/APP_EXTRACTION.md.
export const AppContext = createContext(null);

/** Convenience for the common case; `useContext(AppContext)` remains equivalent. */
export const useApp = () => useContext(AppContext);
