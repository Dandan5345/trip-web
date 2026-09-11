import { initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

import { appCheckDebugToken, appCheckSiteKey, firebaseConfig, isDev } from './config';

export const firebaseApp = initializeApp(firebaseConfig);

if (appCheckSiteKey) {
  if (isDev && appCheckDebugToken) {
    // Recognised by the App Check SDK; only ever set from an untracked
    // .env.local during development.
    (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(firebaseApp);

// Long polling is auto-detected: corporate proxies that break the streaming
// transport would otherwise leave the trip stuck on its skeleton.
export const firestore = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
});
