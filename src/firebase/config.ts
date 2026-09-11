/**
 * Firebase web configuration.
 *
 * These values are public by design — they identify the project, they do not
 * authorise anything. Access is decided by Firestore rules and App Check.
 * Real secrets (Worker tokens, service accounts, private API keys) never
 * appear in this repository.
 *
 * Every value can be overridden through Vite env vars so the client can be
 * pointed at another project without editing code.
 */
// `import.meta.env` only exists under Vite. Guarding it lets these modules be
// imported from a plain Node script (the interop and verification tooling)
// without the bundle-time globals.
const rawEnv: Record<string, unknown> =
  (import.meta as { env?: Record<string, unknown> }).env ?? {};
const env = rawEnv as Record<string, string | undefined>;

/** True only under `vite dev`. Vite injects a real boolean here. */
export const isDev: boolean = rawEnv.DEV === true || rawEnv.DEV === 'true';

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBZGLV8MNwjoWRY0_KVgetVtpTHyTpII2k',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'trip-planner-pro-3fbd2.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'trip-planner-pro-3fbd2',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'trip-planner-pro-3fbd2.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '726939691292',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:726939691292:web:3af4b46270d6edc548b2d9',
} as const;

/**
 * reCAPTCHA v3 site key for App Check, registered in
 * Firebase Console → App Check → Apps → this web app.
 *
 * Also public. When it is absent App Check is simply not initialised, so a
 * local `npm run dev` works without one; production must set it.
 */
export const appCheckSiteKey: string | undefined = env.VITE_APPCHECK_SITE_KEY;

/**
 * App Check debug token for local development. Never set this in production
 * and never commit one — put it in an untracked `.env.local`.
 */
export const appCheckDebugToken: string | undefined = env.VITE_APPCHECK_DEBUG_TOKEN;
