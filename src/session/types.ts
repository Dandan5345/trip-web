export type SessionStatus =
  | 'initialising'
  | 'pending'
  | 'approving'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'locked'
  | 'error';

export type SessionErrorCode = 'anon-disabled' | 'offline' | 'permission' | 'unknown';

export interface PendingSession {
  webUid: string;
  /** The 8-character code, unformatted. Also the session's nonce. */
  code: string;
  /** What the QR encodes. Contains the code, never a key. */
  qrUrl: string;
  expiresAt: Date;
}

export interface ActiveSession {
  webUid: string;
  tripId: string;
  ownerUid: string;
  canEdit: boolean;
  canViewSensitive: boolean;
  shareMode: 'secure' | 'basic';
  expiresAt: Date;
  /**
   * Base64 AES-256 trip key, in memory only.
   *
   * Null when the phone did not grant sensitive access, or when the trip is a
   * basic share with nothing encrypted. Never persisted, never logged, never
   * sent anywhere.
   */
  tripKey: string | null;
  approvedByUsername: string | null;
}

export interface SessionSnapshot {
  status: SessionStatus;
  pending: PendingSession | null;
  active: ActiveSession | null;
  errorCode: SessionErrorCode | null;
}
