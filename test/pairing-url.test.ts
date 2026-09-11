import { describe, expect, it } from 'vitest';

import { createPairingUrl } from '../src/session/pairingUrl';

const ticket = {
  version: 1,
  sessionId: 'web-uid-123',
  nonce: 'ABCD2345',
  fingerprint: 'fingerprint/value',
};

describe('createPairingUrl', () => {
  it('uses the root pairing route for local and Firebase builds', () => {
    expect(
      createPairingUrl({ origin: 'http://localhost:5173', basePath: '/', ...ticket }),
    ).toBe(
      'http://localhost:5173/pair#v=1&sid=web-uid-123&n=ABCD2345&f=fingerprint%2Fvalue',
    );
  });

  it('keeps the GitHub Pages repository path in the QR payload', () => {
    expect(
      createPairingUrl({
        origin: 'https://dandan5345.github.io',
        basePath: '/trip-web/',
        ...ticket,
      }),
    ).toBe(
      'https://dandan5345.github.io/trip-web/pair#v=1&sid=web-uid-123&n=ABCD2345&f=fingerprint%2Fvalue',
    );
  });
});
