/**
 * Browser half of the QR pairing key transfer.
 *
 * The browser publishes only an ECDH public key. The phone, which already
 * holds the trip's AES key, does a key agreement against that public key,
 * derives a wrapping key with HKDF-SHA256 and ships the trip key wrapped in
 * AES-GCM. The plain trip key therefore never exists anywhere but in the two
 * endpoints' memory — not in Firestore, not in the QR, not in any log.
 *
 * The Dart counterpart is `lib/services/web_pairing_crypto.dart`; the two are
 * pinned together by the vectors in `test/fixtures/`.
 */
import { base64Decode, base64Encode, base64UrlEncode, utf8 } from './bytes';

export const PAIRING_VERSION = 1;
export const WRAPPING_ALGORITHM = 'ECDH-P256+HKDF-SHA256+AES-256-GCM';
const HKDF_SALT = 'TripEase-Web-Pairing-v1';
const GCM_NONCE_LENGTH = 12;

export class PairingCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingCryptoError';
  }
}

export interface BrowserPairingKeys {
  /** Non-extractable. Lives only in this JS heap, never persisted. */
  privateKey: CryptoKey;
  /** Raw uncompressed P-256 point (65 bytes), base64. */
  publicKeyBase64: string;
  /** Short SHA-256 digest of the public key, carried in the QR. */
  fingerprint: string;
}

/** Context bound into both the HKDF info and the AES-GCM AAD. */
export interface PairingContext {
  webUid: string;
  tripId: string;
  ownerUid: string;
  encryptionVersion: number;
}

export function pairingContextBytes(context: PairingContext): Uint8Array {
  return utf8(
    `${context.webUid}|${context.tripId}|${context.ownerUid}|${context.encryptionVersion}`,
  );
}

export async function publicKeyFingerprint(publicKeyBase64: string): Promise<string> {
  const raw = base64Decode(publicKeyBase64);
  const digest = await crypto.subtle.digest('SHA-256', raw as unknown as ArrayBuffer);
  return base64UrlEncode(new Uint8Array(digest).subarray(0, 12));
}

/**
 * Accept whatever a person typed: spacing, dashes and case are noise.
 *
 * Must stay identical to `WebPairingCrypto.normalizePairingCode` in the app —
 * both sides hash the normalised form, so a code scanned from the QR and the
 * same code typed by hand produce the same digest.
 */
export function normalizePairingCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** SHA-256 of a pairing nonce, base64 — the only form Firestore ever sees. */
export async function nonceHash(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    utf8(normalizePairingCode(nonce)) as unknown as ArrayBuffer,
  );
  return base64Encode(new Uint8Array(digest));
}

export async function generateBrowserPairingKeys(): Promise<BrowserPairingKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    // extractable: false — the private key can never be read back out of the
    // browser, not by this code and not by anything that injects into it.
    false,
    ['deriveBits'],
  );
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const publicKeyBase64 = base64Encode(rawPublic);
  return {
    privateKey: pair.privateKey,
    publicKeyBase64,
    fingerprint: await publicKeyFingerprint(publicKeyBase64),
  };
}

async function deriveWrappingKey(
  privateKey: CryptoKey,
  appPublicKeyBase64: string,
  context: PairingContext,
): Promise<CryptoKey> {
  let appPublicKey: CryptoKey;
  try {
    appPublicKey = await crypto.subtle.importKey(
      'raw',
      base64Decode(appPublicKeyBase64) as unknown as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
  } catch {
    throw new PairingCryptoError('The phone sent an unusable public key');
  }

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: appPublicKey },
    privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: utf8(HKDF_SALT) as unknown as ArrayBuffer,
      info: pairingContextBytes(context) as unknown as ArrayBuffer,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

/**
 * Unwrap the trip key the phone put on the session document.
 *
 * Returns the base64 AES-256 trip key. The caller must keep it in memory only.
 */
export async function unwrapTripKey(options: {
  privateKey: CryptoKey;
  appPublicKeyBase64: string;
  wrappedTripKeyBase64: string;
  context: PairingContext;
}): Promise<string> {
  const wrapped = base64Decode(options.wrappedTripKeyBase64);
  if (wrapped.length <= GCM_NONCE_LENGTH) {
    throw new PairingCryptoError('Wrapped trip key is malformed');
  }
  const wrappingKey = await deriveWrappingKey(
    options.privateKey,
    options.appPublicKeyBase64,
    options.context,
  );
  const nonce = wrapped.subarray(0, GCM_NONCE_LENGTH);
  const ciphertext = wrapped.subarray(GCM_NONCE_LENGTH);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce as unknown as ArrayBuffer,
        additionalData: pairingContextBytes(options.context) as unknown as ArrayBuffer,
        tagLength: 128,
      },
      wrappingKey,
      ciphertext as unknown as ArrayBuffer,
    );
  } catch {
    // Wrong key, tampered ciphertext, or an AAD that does not match the
    // session this browser actually opened.
    throw new PairingCryptoError('Could not open the wrapped trip key');
  }
  const keyBytes = new Uint8Array(plain);
  if (keyBytes.length !== 32) throw new PairingCryptoError('Unwrapped trip key has the wrong size');
  return base64Encode(keyBytes);
}
