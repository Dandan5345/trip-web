/**
 * The human-typeable pairing code, mirroring
 * `WebPairingCrypto.pairingCodeAlphabet` in the Flutter app.
 *
 * The code *is* the session nonce, so the QR and the typed code are literally
 * the same secret — there is no second, weaker path into a session.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;

export function createPairingCode(): string {
  const bytes = new Uint8Array(PAIRING_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) {
    // 256 is not a multiple of 30, so the top values are resampled rather than
    // folded — a biased pairing code is a smaller keyspace.
    let value = byte;
    while (value >= 240) {
      const extra = new Uint8Array(1);
      crypto.getRandomValues(extra);
      value = extra[0];
    }
    code += ALPHABET[value % ALPHABET.length];
  }
  return code;
}

/** `ABCD-EFGH` — how the code is shown to a human. */
export function formatPairingCode(code: string): string {
  if (code.length !== PAIRING_CODE_LENGTH) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
