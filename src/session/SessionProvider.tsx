import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { browserSessionPersistence, setPersistence, signInAnonymously } from 'firebase/auth';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';

import { auth, firestore } from '../firebase/app';
import {
  PAIRING_VERSION,
  generateBrowserPairingKeys,
  nonceHash,
  unwrapTripKey,
} from '../crypto/pairing';
import type { BrowserPairingKeys } from '../crypto/pairing';
import { describeBrowser } from './browserName';
import { createPairingCode } from './pairingCode';
import { createPairingUrl } from './pairingUrl';
import type { ActiveSession, PendingSession, SessionErrorCode, SessionSnapshot } from './types';

/** How long a QR stays scannable. The rules cap this at 15 minutes. */
const PENDING_TTL_MS = 5 * 60 * 1000;

/** No mouse, keyboard or touch for this long and the trip closes itself. */
const IDLE_LIMIT_MS = 20 * 60 * 1000;

interface SessionValue extends SessionSnapshot {
  /** Throw away the current pending session and publish a fresh one. */
  restart: () => Promise<void>;
  /** End the session deliberately: revoke it and wipe the key from memory. */
  closeSession: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    status: 'initialising',
    pending: null,
    active: null,
    errorCode: null,
  });

  /**
   * The ECDH private key is a non-extractable CryptoKey held in a ref and
   * nowhere else. It is not in state (which React could retain in devtools),
   * not in storage, and cannot be exported even by code running on this page.
   */
  const keysRef = useRef<BrowserPairingKeys | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const currentCodeRef = useRef<string | null>(null);
  const currentWebUidRef = useRef<string | null>(null);
  const startingRef = useRef(false);

  const clearKeys = useCallback(() => {
    keysRef.current = null;
  }, []);

  const detachListener = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const classifyError = useCallback((error: unknown): SessionErrorCode => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';
    if (code.includes('admin-restricted-operation') || code.includes('operation-not-allowed')) {
      return 'anon-disabled';
    }
    if (code.includes('network-request-failed') || code.includes('unavailable')) return 'offline';
    if (code.includes('permission-denied')) return 'permission';
    return 'unknown';
  }, []);

  /** Remove the pending session and its code pointer. Best effort. */
  const cleanUpPending = useCallback(async (webUid: string, code: string | null) => {
    const tasks: Promise<unknown>[] = [];
    if (code) {
      tasks.push(deleteDoc(doc(firestore, 'web_session_codes', code)).catch(() => undefined));
    }
    tasks.push(
      updateDoc(doc(firestore, 'web_sessions', webUid), {
        status: 'revoked',
        revokedAt: serverTimestamp(),
      }).catch(() => undefined),
    );
    await Promise.all(tasks);
  }, []);

  const handleSessionDoc = useCallback(
    async (data: DocumentData | undefined, pending: PendingSession) => {
      if (!data) return;
      const status = data.status as string | undefined;

      if (status === 'revoked') {
        clearKeys();
        detachListener();
        setSnapshot({ status: 'revoked', pending: null, active: null, errorCode: null });
        return;
      }

      if (status !== 'approved') return;

      const usedCode = currentCodeRef.current;
      if (usedCode) {
        currentCodeRef.current = null;
        void deleteDoc(doc(firestore, 'web_session_codes', usedCode)).catch(() => undefined);
      }

      const expiresAt = (data.expiresAt as Timestamp | undefined)?.toDate() ?? new Date(0);
      if (expiresAt.getTime() <= Date.now()) {
        clearKeys();
        setSnapshot({ status: 'expired', pending: null, active: null, errorCode: null });
        return;
      }

      const tripId = String(data.tripId ?? '');
      const ownerUid = String(data.ownerUid ?? '');
      if (!tripId || !ownerUid) return;

      setSnapshot((previous) =>
        previous.status === 'pending' ? { ...previous, status: 'approving' } : previous,
      );

      let tripKey: string | null = null;
      const wrapped = data.wrappedTripKey as string | undefined;
      const appPublicKey = data.appPublicKey as string | undefined;
      const keys = keysRef.current;

      if (wrapped && appPublicKey && keys) {
        try {
          tripKey = await unwrapTripKey({
            privateKey: keys.privateKey,
            appPublicKeyBase64: appPublicKey,
            wrappedTripKeyBase64: wrapped,
            context: {
              webUid: pending.webUid,
              tripId,
              ownerUid,
              encryptionVersion: Number(data.encryptionVersion ?? PAIRING_VERSION),
            },
          });
        } catch {
          // Never surface why: the page simply has no key, and the trip's
          // sensitive fields stay visibly locked instead of half-broken.
          tripKey = null;
        }
      }

      const active: ActiveSession = {
        webUid: pending.webUid,
        tripId,
        ownerUid,
        canEdit: data.canEdit === true,
        canViewSensitive: data.canViewSensitive === true,
        shareMode: data.shareMode === 'basic' ? 'basic' : 'secure',
        expiresAt,
        tripKey,
        approvedByUsername: (data.approvedByUsername as string | undefined) ?? null,
      };
      setSnapshot({ status: 'active', pending: null, active, errorCode: null });
    },
    [clearKeys, detachListener],
  );

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    detachListener();
    clearKeys();

    try {
      // Session persistence, not local: closing the tab drops the anonymous
      // user entirely, so nothing about this pairing survives the window.
      await setPersistence(auth, browserSessionPersistence);
      const credential = await signInAnonymously(auth);
      const webUid = credential.user.uid;
      currentWebUidRef.current = webUid;

      // A reload keeps the anonymous user but loses the in-memory private key,
      // so any session left over from before the reload can never be opened
      // again. Remove it before publishing the replacement: setDoc on an
      // existing document is an update, and the rules deliberately forbid a
      // browser from changing pending/approved/revoked back to pending.
      const sessionRef = doc(firestore, 'web_sessions', webUid);
      const existing = await getDoc(sessionRef);
      if (existing.exists()) {
        await deleteDoc(sessionRef);
      }

      const keys = await generateBrowserPairingKeys();
      keysRef.current = keys;

      const code = createPairingCode();
      currentCodeRef.current = code;
      const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

      await setDoc(sessionRef, {
        webUid,
        status: 'pending',
        nonceHash: await nonceHash(code),
        browserPublicKey: keys.publicKeyBase64,
        browserPublicKeyFingerprint: keys.fingerprint,
        browserName: describeBrowser(),
        origin: window.location.origin,
        pairingVersion: PAIRING_VERSION,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      await setDoc(doc(firestore, 'web_session_codes', code), {
        sessionId: webUid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      const qrUrl = createPairingUrl({
        origin: window.location.origin,
        basePath: import.meta.env.BASE_URL,
        version: PAIRING_VERSION,
        sessionId: webUid,
        nonce: code,
        fingerprint: keys.fingerprint,
      });

      const pending: PendingSession = { webUid, code, qrUrl, expiresAt };
      setSnapshot({ status: 'pending', pending, active: null, errorCode: null });

      unsubscribeRef.current = onSnapshot(
        doc(firestore, 'web_sessions', webUid),
        (docSnapshot) => {
          void handleSessionDoc(docSnapshot.data(), pending);
        },
        (error) => {
          setSnapshot({
            status: 'error',
            pending: null,
            active: null,
            errorCode: classifyError(error),
          });
        },
      );
    } catch (error) {
      setSnapshot({
        status: 'error',
        pending: null,
        active: null,
        errorCode: classifyError(error),
      });
    } finally {
      startingRef.current = false;
    }
  }, [classifyError, clearKeys, detachListener, handleSessionDoc]);


  const closeSession = useCallback(async () => {
    const webUid = currentWebUidRef.current ?? auth.currentUser?.uid;
    detachListener();
    clearKeys();
    setSnapshot({ status: 'revoked', pending: null, active: null, errorCode: null });
    if (webUid) await cleanUpPending(webUid, currentCodeRef.current);
  }, [cleanUpPending, clearKeys, detachListener]);

  const restart = useCallback(async () => {
    setSnapshot({ status: 'initialising', pending: null, active: null, errorCode: null });
    const webUid = currentWebUidRef.current;
    if (webUid) {
      // Retire the old code so a screenshot of it stops working immediately.
      await cleanUpPending(webUid, currentCodeRef.current);
    }
    await start();
  }, [cleanUpPending, start]);

  // ── Boot ────────────────────────────────────────────────
  useEffect(() => {
    // Opening the pairing session is exactly what an effect is for: it talks
    // to Firebase and subscribes for updates. Every setState inside `start`
    // runs in a promise continuation or a snapshot callback, never
    // synchronously during this effect, so there is no cascading render here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return () => {
      detachListener();
      clearKeys();
    };
    // Runs once for the provider's lifetime: re-pairing goes through restart().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── The pending code times out on its own ───────────────
  useEffect(() => {
    if (snapshot.status !== 'pending' || !snapshot.pending) return;
    const remaining = Math.max(0, snapshot.pending.expiresAt.getTime() - Date.now());
    const timer = window.setTimeout(() => {
      setSnapshot((previous) =>
        previous.status === 'pending'
          ? { status: 'expired', pending: null, active: null, errorCode: null }
          : previous,
      );
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [snapshot.status, snapshot.pending]);

  // ── An approved session also ends on its own ────────────
  useEffect(() => {
    if (snapshot.status !== 'active' || !snapshot.active) return;
    const remaining = snapshot.active.expiresAt.getTime() - Date.now();
    const timer = window.setTimeout(
      () => {
        clearKeys();
        detachListener();
        setSnapshot({ status: 'expired', pending: null, active: null, errorCode: null });
      },
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [snapshot.status, snapshot.active, clearKeys, detachListener]);

  // ── Idle lock ───────────────────────────────────────────
  useEffect(() => {
    if (snapshot.status !== 'active') return;

    let timer = 0;
    const lock = () => {
      const webUid = currentWebUidRef.current;
      detachListener();
      clearKeys();
      setSnapshot({ status: 'locked', pending: null, active: null, errorCode: null });
      if (webUid) void cleanUpPending(webUid, currentCodeRef.current);
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, IDLE_LIMIT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'wheel',
      'focus',
      'touchstart',
    ];
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    reset();

    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [snapshot.status, snapshot.active, cleanUpPending, clearKeys, detachListener]);

  const value = useMemo<SessionValue>(
    () => ({ ...snapshot, restart, closeSession }),
    [snapshot, restart, closeSession],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The active session, or null while pairing. */
// eslint-disable-next-line react-refresh/only-export-components
export function useActiveSession(): ActiveSession | null {
  return useSession().active;
}
