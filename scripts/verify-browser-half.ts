/**
 * Drives the real browser-side pairing code against the live project, using
 * the same modules the page uses — not a hand-written mock of them.
 *
 * Proves that what SessionProvider writes is actually accepted by the
 * deployed rules, and prints a pairing code you can type into the app.
 *
 *   npx tsx scripts/verify-browser-half.ts          # create and tear down
 *   npx tsx scripts/verify-browser-half.ts --hold   # leave it open to pair
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  Timestamp,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { firebaseConfig } from '../src/firebase/config';
import { PAIRING_VERSION, generateBrowserPairingKeys, nonceHash, unwrapTripKey } from '../src/crypto/pairing';
import { createPairingCode, formatPairingCode } from '../src/session/pairingCode';
import { describeBrowser } from '../src/session/browserName';

const hold = process.argv.includes('--hold');
const ORIGIN = 'http://localhost:5173';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function ok(label: string) {
  console.log(`  PASS  ${label}`);
}

async function main() {
  const credential = await signInAnonymously(auth);
  const webUid = credential.user.uid;
  ok(`anonymous sign-in (${webUid})`);

  const keys = await generateBrowserPairingKeys();
  ok(`ECDH P-256 key pair, private key extractable = ${keys.privateKey.extractable}`);
  if (keys.privateKey.extractable) throw new Error('private key must be non-extractable');

  const code = createPairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await setDoc(doc(db, 'web_sessions', webUid), {
    webUid,
    status: 'pending',
    nonceHash: await nonceHash(code),
    browserPublicKey: keys.publicKeyBase64,
    browserPublicKeyFingerprint: keys.fingerprint,
    browserName: describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/140 Safari/537.36'),
    origin: ORIGIN,
    pairingVersion: PAIRING_VERSION,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  ok('pending session accepted by the deployed rules');

  await setDoc(doc(db, 'web_session_codes', code), {
    sessionId: webUid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  ok('pairing-code pointer accepted');

  if (!hold) {
    await deleteDoc(doc(db, 'web_session_codes', code));
    await updateDoc(doc(db, 'web_sessions', webUid), {
      status: 'revoked',
      revokedAt: serverTimestamp(),
    });
    ok('session revoked and code retired');
    console.log('\nbrowser half verified against production.');
    process.exit(0);
  }

  console.log('\n  ┌──────────────────────────────┐');
  console.log(`  │   type this in the app:  ${formatPairingCode(code)}   │`);
  console.log('  └──────────────────────────────┘');
  console.log('  waiting for the phone to approve…\n');

  onSnapshot(doc(db, 'web_sessions', webUid), (snapshot) => {
    const data = snapshot.data();
    if (!data || data.status !== 'approved') return;
    void (async () => {
      console.log(`  PASS  approved for trip ${data.tripId}`);
      console.log(`        canEdit=${data.canEdit} canViewSensitive=${data.canViewSensitive} shareMode=${data.shareMode}`);
      if (data.wrappedTripKey && data.appPublicKey) {
        const tripKey = await unwrapTripKey({
          privateKey: keys.privateKey,
          appPublicKeyBase64: data.appPublicKey,
          wrappedTripKeyBase64: data.wrappedTripKey,
          context: {
            webUid,
            tripId: data.tripId,
            ownerUid: data.ownerUid,
            encryptionVersion: Number(data.encryptionVersion ?? PAIRING_VERSION),
          },
        });
        // Never print the key; only prove it came back the right size.
        console.log(`  PASS  trip key unwrapped (${Buffer.from(tripKey, 'base64').length} bytes)`);
      } else {
        console.log('  ----  no wrapped key (sensitive access not granted)');
      }
      await updateDoc(doc(db, 'web_sessions', webUid), {
        status: 'revoked',
        revokedAt: serverTimestamp(),
      });
      console.log('  PASS  session revoked\n');
      process.exit(0);
    })();
  });

  setTimeout(() => {
    console.log('  timed out waiting for approval.');
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
