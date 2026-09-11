/**
 * A short, human-checkable description of this browser, shown on the phone's
 * confirmation screen ("Chrome on macOS"). Deliberately coarse: enough to
 * recognise your own machine, not enough to fingerprint it.
 */
export function describeBrowser(userAgent: string = navigator.userAgent): string {
  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);
  if (browser && platform) return `${browser} · ${platform}`;
  return browser ?? platform ?? 'Desktop browser';
}

function detectBrowser(ua: string): string | null {
  if (/\bEdg\//.test(ua)) return 'Edge';
  if (/\bOPR\//.test(ua) || /\bOpera\b/.test(ua)) return 'Opera';
  if (/\bFirefox\//.test(ua)) return 'Firefox';
  if (/\bChrome\//.test(ua)) return 'Chrome';
  if (/\bSafari\//.test(ua)) return 'Safari';
  return null;
}

function detectPlatform(ua: string): string | null {
  if (/\bWindows\b/.test(ua)) return 'Windows';
  if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) return 'macOS';
  if (/\bCrOS\b/.test(ua)) return 'ChromeOS';
  if (/\bAndroid\b/.test(ua)) return 'Android';
  if (/\biPhone\b|\biPad\b/.test(ua)) return 'iOS';
  if (/\bLinux\b/.test(ua)) return 'Linux';
  return null;
}
