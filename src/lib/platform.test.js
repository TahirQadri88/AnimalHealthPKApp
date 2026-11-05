import { describe, it, expect } from 'vitest';
import { isIOS } from './platform';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('isIOS', () => {
  it('recognises an iPhone in its normal mode', () => {
    expect(isIOS({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
  });
  it('recognises an iPhone showing the desktop site (identity string says Mac)', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);   // and when platform says Mac too
  });
  it('recognises an iPad presenting as a Mac', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });
  it('recognises the home-screen app by its own flag', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'Linux', maxTouchPoints: 0, standalone: true })).toBe(true);
  });
  it('does not mistake a real Mac, Windows or Android for iOS', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', platform: 'Win32', maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile', platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0, standalone: false })).toBe(false);
  });
  it('is false when there is no navigator', () => { expect(isIOS(undefined)).toBe(false); });
});
