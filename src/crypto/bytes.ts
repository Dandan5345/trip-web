/** Byte / text / base64 helpers shared by the TE2 and pairing crypto. */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export function utf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function fromUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export function base64Decode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Length-independent, data-independent comparison.
 *
 * JavaScript cannot promise true constant time, but this avoids the early
 * return that turns a tag check into a byte-by-byte oracle.
 */
export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let diff = left.length ^ right.length;
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}
