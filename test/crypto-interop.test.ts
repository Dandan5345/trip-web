/**
 * The web half of the Dart ↔ TypeScript crypto contract.
 *
 * Fixtures are produced by the other side:
 *   dart_vectors.json  ← `UPDATE_CRYPTO_VECTORS=1 flutter test test/web_crypto_interop_test.dart`
 *   web_vectors.json   ← `npm run gen:vectors` (read back here as a regression guard)
 */
import { describe, expect, it } from 'vitest';

import { base64Decode, base64Encode } from '../src/crypto/bytes';
import { Te2Error, decryptBytes, decryptField, encryptField } from '../src/crypto/te2';
import {
  PairingCryptoError,
  nonceHash,
  normalizePairingCode,
  publicKeyFingerprint,
  unwrapTripKey,
} from '../src/crypto/pairing';
import { decryptPayload, encryptPayload } from '../src/trip/sensitivity';

import dartVectors from './fixtures/dart_vectors.json' with { type: 'json' };
import webVectors from './fixtures/web_vectors.json' with { type: 'json' };
import pairingKeys from './fixtures/pairing_keys.json' with { type: 'json' };

const PRIMARY_KEY = dartVectors.keys.primary;
const OTHER_TRIP_KEY = dartVectors.keys.otherTrip;

function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importBrowserPrivateKey(role: 'browser' | 'app' = 'browser'): Promise<CryptoKey> {
  const key = pairingKeys[role];
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: toBase64Url(key.d),
      x: toBase64Url(key.x),
      y: toBase64Url(key.y),
      ext: true,
    },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
}

describe('TE2 envelope — Dart writes, the web reads', () => {
  it('decrypts every committed Dart vector', async () => {
    expect(dartVectors.te2.length).toBeGreaterThan(0);
    for (const vector of dartVectors.te2) {
      await expect(decryptField(vector.ciphertext, vector.key)).resolves.toBe(vector.plaintext);
    }
  });

  it('decrypts a sensitive payload the app encrypted', async () => {
    const payload = dartVectors.sensitivePayload;
    const decrypted = await decryptPayload(JSON.parse(payload.encrypted), payload.key);
    const notes = decrypted.notesData as Record<string, unknown>[];
    const logistics = decrypted.logisticsData as Record<string, unknown>[];
    const bookings = decrypted.bookingConfirmationsData as Record<string, unknown>[];
    const documents = decrypted.documentsData as Record<string, unknown>[];

    expect(notes[0].content).toBe(payload.expectedNote);
    expect(logistics[0].notes).toBe(payload.expectedLogisticsNote);
    expect(bookings[0].orderNumber).toBe(payload.expectedOrderNumber);
    expect(documents[0].name).toBe(payload.expectedDocumentName);
    // Numeric sensitive fields come back as numbers, not strings.
    expect(logistics[0].totalPrice).toBe(420.5);
    expect(bookings[0].price).toBe(120);
    // Fully decrypted items drop the flag so they are never re-encrypted twice.
    expect(notes[0]._encrypted).toBeUndefined();
  });

  it('leaves items encrypted and flagged when the key is wrong', async () => {
    const payload = dartVectors.sensitivePayload;
    const decrypted = await decryptPayload(JSON.parse(payload.encrypted), OTHER_TRIP_KEY);
    const notes = decrypted.notesData as Record<string, unknown>[];
    expect(notes[0]._encrypted).toBe(true);
    expect(notes[0].content).not.toBe(payload.expectedNote);
  });
});

describe('TE2 envelope — the web writes, the web reads', () => {
  it('round-trips its own committed vectors', async () => {
    for (const vector of webVectors.te2) {
      await expect(decryptField(vector.ciphertext, vector.key)).resolves.toBe(vector.plaintext);
    }
  });

  it('round-trips binary payloads', async () => {
    const { key, plaintextBase64, ciphertext } = webVectors.binary;
    const plain = await decryptBytes(base64Decode(ciphertext), key);
    expect(base64Encode(plain)).toBe(plaintextBase64);
  });

  it('reads a legacy pre-v2 envelope', async () => {
    const { key, plaintext, ciphertext } = webVectors.legacy;
    await expect(decryptField(ciphertext, key)).resolves.toBe(plaintext);
  });

  it('rejects a single flipped byte', async () => {
    const sealed = await encryptField('tamper me', PRIMARY_KEY);
    const bytes = base64Decode(sealed);
    for (const index of [7, bytes.length - 20, bytes.length - 1]) {
      const mutated = Uint8Array.from(bytes);
      mutated[index] ^= 0x01;
      await expect(decryptField(base64Encode(mutated), PRIMARY_KEY)).rejects.toBeInstanceOf(
        Te2Error,
      );
    }
  });

  it('rejects another trip key', async () => {
    const sealed = await encryptField('secret', PRIMARY_KEY);
    await expect(decryptField(sealed, OTHER_TRIP_KEY)).rejects.toBeInstanceOf(Te2Error);
  });

  it('rejects a key that is not 256 bits', async () => {
    await expect(encryptField('x', base64Encode(new Uint8Array(16)))).rejects.toBeInstanceOf(
      Te2Error,
    );
  });

  it('never encrypts an empty field, which the app cannot decode', async () => {
    const encrypted = await encryptPayload(
      { notesData: [{ id: 'n1', title: '', content: 'kept' }] },
      PRIMARY_KEY,
    );
    const note = (encrypted.notesData as Record<string, unknown>[])[0];
    expect(note.title).toBe('');
    expect(note.content).not.toBe('kept');
  });
});

describe('pairing key wrap — the phone wraps, the browser unwraps', () => {
  const vector = dartVectors.wrappedTripKey;

  it('opens the trip key the Flutter app wrapped', async () => {
    const tripKey = await unwrapTripKey({
      privateKey: await importBrowserPrivateKey(),
      appPublicKeyBase64: vector.appPublicKeyRaw,
      wrappedTripKeyBase64: vector.wrappedTripKey,
      context: {
        webUid: vector.webUid,
        tripId: vector.tripId,
        ownerUid: vector.ownerUid,
        encryptionVersion: vector.encryptionVersion,
      },
    });
    expect(tripKey).toBe(vector.expectedTripKey);
  });

  it('opens nothing when any AAD component is wrong', async () => {
    const privateKey = await importBrowserPrivateKey();
    const base = {
      webUid: vector.webUid,
      tripId: vector.tripId,
      ownerUid: vector.ownerUid,
      encryptionVersion: vector.encryptionVersion,
    };
    const wrongContexts = [
      { ...base, webUid: 'someone-elses-session' },
      { ...base, tripId: 'another-trip' },
      { ...base, ownerUid: 'another-owner' },
      { ...base, encryptionVersion: 3 },
    ];
    for (const context of wrongContexts) {
      await expect(
        unwrapTripKey({
          privateKey,
          appPublicKeyBase64: vector.appPublicKeyRaw,
          wrappedTripKeyBase64: vector.wrappedTripKey,
          context,
        }),
      ).rejects.toBeInstanceOf(PairingCryptoError);
    }
  });

  it('opens nothing with a different browser key pair', async () => {
    const intruder = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
    await expect(
      unwrapTripKey({
        privateKey: intruder.privateKey,
        appPublicKeyBase64: vector.appPublicKeyRaw,
        wrappedTripKeyBase64: vector.wrappedTripKey,
        context: {
          webUid: vector.webUid,
          tripId: vector.tripId,
          ownerUid: vector.ownerUid,
          encryptionVersion: vector.encryptionVersion,
        },
      }),
    ).rejects.toBeInstanceOf(PairingCryptoError);
  });

  it('agrees with Dart on nonce hashes and key fingerprints', async () => {
    await expect(nonceHash(webVectors.pairing.nonce)).resolves.toBe(webVectors.pairing.nonceHash);
    await expect(publicKeyFingerprint(pairingKeys.browser.publicKeyRaw)).resolves.toBe(
      webVectors.pairing.browserFingerprint,
    );
  });

  it('hashes a typed code and a scanned code to the same digest', async () => {
    const { nonce } = webVectors.pairing;
    const typed = `${nonce.slice(0, 4).toLowerCase()}-${nonce.slice(4).toLowerCase()}`;
    expect(normalizePairingCode(typed)).toBe(nonce);
    await expect(nonceHash(typed)).resolves.toBe(webVectors.pairing.nonceHash);
    await expect(nonceHash(typed)).resolves.toBe(webVectors.pairing.nonceHashFromTypedForm);
  });
});
