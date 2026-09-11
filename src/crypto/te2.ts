/**
 * The TripEase "TE2" authenticated envelope, as implemented by
 * `lib/services/trip_encryption_service.dart` in the Flutter app.
 *
 * Wire format (all binary, then base64 for Firestore string fields):
 *
 *   magic(6) | iv(16) | AES-CTR(PKCS7(plaintext)) | HMAC-SHA256(32)
 *
 *   encKey = HMAC-SHA256(masterKey, "TripEase AES key v2")
 *   macKey = HMAC-SHA256(masterKey, "TripEase HMAC key v2")
 *   tag    = HMAC-SHA256(macKey, magic | iv | ciphertext)
 *
 * The Dart side uses `package:encrypt`'s default AES mode (SIC == CTR) with
 * PKCS7 padding, so the padding is applied to the plaintext *before* the CTR
 * keystream — WebCrypto's AES-CTR does not pad, so we do it here.
 *
 * Legacy payloads (written before the v2 upgrade) carry no magic and no tag:
 * `iv(16) | AES-CTR(PKCS7(plaintext))` keyed directly with the master key.
 * They are still readable so old shared trips do not break.
 */
import { base64Decode, base64Encode, concat, fromUtf8, randomBytes, timingSafeEqual, utf8 } from './bytes';

const MAGIC = new Uint8Array([0x54, 0x45, 0x32, 0x00, 0xa5, 0x7c]);
const IV_LENGTH = 16;
const TAG_LENGTH = 32;
const AES_PURPOSE = 'TripEase AES key v2';
const HMAC_PURPOSE = 'TripEase HMAC key v2';

export class Te2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Te2Error';
  }
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data as unknown as ArrayBuffer);
  return new Uint8Array(signature);
}

function pkcs7Pad(input: Uint8Array): Uint8Array {
  const padLength = 16 - (input.length % 16);
  const out = new Uint8Array(input.length + padLength);
  out.set(input, 0);
  out.fill(padLength, input.length);
  return out;
}

function pkcs7Unpad(input: Uint8Array): Uint8Array {
  if (input.length === 0 || input.length % 16 !== 0) {
    throw new Te2Error('Invalid padded length');
  }
  const padLength = input[input.length - 1];
  if (padLength < 1 || padLength > 16 || padLength > input.length) {
    throw new Te2Error('Invalid PKCS7 padding');
  }
  for (let i = input.length - padLength; i < input.length; i += 1) {
    if (input[i] !== padLength) throw new Te2Error('Invalid PKCS7 padding');
  }
  return input.subarray(0, input.length - padLength);
}

async function aesCtr(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'AES-CTR' },
    false,
    ['encrypt', 'decrypt'],
  );
  // `length: 128` matches PointyCastle's SIC, which increments the whole
  // 16-byte block as one big-endian counter.
  const result = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv as unknown as ArrayBuffer, length: 128 },
    cryptoKey,
    data as unknown as ArrayBuffer,
  );
  return new Uint8Array(result);
}

export function decodeMasterKey(base64Key: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = base64Decode(base64Key);
  } catch {
    throw new Te2Error('Trip key is not valid base64');
  }
  if (bytes.length !== 32) throw new Te2Error('Trip encryption key must be 256 bits');
  return bytes;
}

async function deriveKeys(masterKey: Uint8Array) {
  const [encryptionKey, authenticationKey] = await Promise.all([
    hmacSha256(masterKey, utf8(AES_PURPOSE)),
    hmacSha256(masterKey, utf8(HMAC_PURPOSE)),
  ]);
  return { encryptionKey, authenticationKey };
}

function hasV2Magic(value: Uint8Array): boolean {
  if (value.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (value[i] !== MAGIC[i]) return false;
  }
  return true;
}

/** Encrypt raw bytes into a TE2 envelope the Flutter app can read. */
export async function encryptBytes(
  plaintext: Uint8Array,
  base64Key: string,
  iv: Uint8Array = randomBytes(IV_LENGTH),
): Promise<Uint8Array> {
  if (iv.length !== IV_LENGTH) throw new Te2Error('IV must be 16 bytes');
  const masterKey = decodeMasterKey(base64Key);
  const { encryptionKey, authenticationKey } = await deriveKeys(masterKey);
  const ciphertext = await aesCtr(encryptionKey, iv, pkcs7Pad(plaintext));
  const authenticated = concat(MAGIC, iv, ciphertext);
  const tag = await hmacSha256(authenticationKey, authenticated);
  return concat(authenticated, tag);
}

/** Decrypt a TE2 envelope (or a legacy `iv | ciphertext` payload). */
export async function decryptBytes(envelope: Uint8Array, base64Key: string): Promise<Uint8Array> {
  const masterKey = decodeMasterKey(base64Key);

  if (hasV2Magic(envelope)) {
    if (envelope.length < MAGIC.length + IV_LENGTH + TAG_LENGTH) {
      throw new Te2Error('Invalid encrypted payload');
    }
    const { encryptionKey, authenticationKey } = await deriveKeys(masterKey);
    const authenticatedLength = envelope.length - TAG_LENGTH;
    const authenticated = envelope.subarray(0, authenticatedLength);
    const suppliedTag = envelope.subarray(authenticatedLength);
    const expectedTag = await hmacSha256(authenticationKey, authenticated);
    if (!timingSafeEqual(suppliedTag, expectedTag)) {
      throw new Te2Error('Encrypted payload authentication failed');
    }
    const iv = authenticated.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
    const ciphertext = authenticated.subarray(MAGIC.length + IV_LENGTH);
    return pkcs7Unpad(await aesCtr(encryptionKey, iv, ciphertext));
  }

  if (envelope.length < IV_LENGTH) throw new Te2Error('Invalid legacy encrypted payload');
  const iv = envelope.subarray(0, IV_LENGTH);
  const ciphertext = envelope.subarray(IV_LENGTH);
  return pkcs7Unpad(await aesCtr(masterKey, iv, ciphertext));
}

/** Encrypt a string field exactly the way `DataSensitivityService` does. */
export async function encryptField(
  plaintext: string,
  base64Key: string,
  iv?: Uint8Array,
): Promise<string> {
  return base64Encode(await encryptBytes(utf8(plaintext), base64Key, iv));
}

/** Decrypt a base64 TE2 string field back to text. */
export async function decryptField(ciphertext: string, base64Key: string): Promise<string> {
  let envelope: Uint8Array;
  try {
    envelope = base64Decode(ciphertext);
  } catch {
    throw new Te2Error('Ciphertext is not valid base64');
  }
  try {
    return fromUtf8(await decryptBytes(envelope, base64Key));
  } catch (error) {
    if (error instanceof Te2Error) throw error;
    throw new Te2Error('Decrypted payload is not valid UTF-8');
  }
}
