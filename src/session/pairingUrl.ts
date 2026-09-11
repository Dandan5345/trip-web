interface PairingUrlOptions {
  origin: string;
  basePath: string;
  version: number;
  sessionId: string;
  nonce: string;
  fingerprint: string;
}

/** Build the QR payload at either /pair or a project-site path such as /trip-web/pair. */
export function createPairingUrl({
  origin,
  basePath,
  version,
  sessionId,
  nonce,
  fingerprint,
}: PairingUrlOptions): string {
  const normalizedOrigin = origin.endsWith('/') ? origin : `${origin}/`;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const appBase = new URL(normalizedBase, normalizedOrigin);
  const url = new URL('pair', appBase);
  url.hash = new URLSearchParams({
    v: String(version),
    sid: sessionId,
    n: nonce,
    f: fingerprint,
  }).toString();
  return url.toString();
}
