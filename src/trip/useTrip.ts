import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timestamp,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { firestore } from '../firebase/app';
import { useSession } from '../session/SessionProvider';
import { decryptPayload } from './sensitivity';
import type { Json } from './sensitivity';
import { parseTripSnapshot } from './model';
import type { TripSnapshot } from './model';

export type TripLoadState = 'loading' | 'ready' | 'missing' | 'denied' | 'error';

export interface TripState {
  state: TripLoadState;
  trip: TripSnapshot | null;
}

/** Raised when the phone changed a field this browser was also editing. */
export class TripConflictError extends Error {
  readonly fields: string[];
  readonly remote: Json;

  constructor(fields: string[], remote: Json) {
    super(`Conflicting fields: ${fields.join(', ')}`);
    this.name = 'TripConflictError';
    this.fields = fields;
    this.remote = remote;
  }
}

/**
 * Live view of the one trip this session was paired with.
 *
 * Reads `shared_trips/{tripId}` — the same document the app reads — and
 * decrypts sensitive fields in the browser with the key the phone wrapped.
 * Without that key the fields stay flagged rather than rendered as garbage.
 */
export function useTrip(): TripState {
  const { active } = useSession();
  const tripId = active?.tripId ?? null;
  const tripKey = active?.tripKey ?? null;

  // Tagged with the trip it describes, so switching sessions reads as
  // "loading" without an effect having to reset anything first.
  const [state, setState] = useState<TripState & { forTrip: string | null }>({
    state: 'loading',
    trip: null,
    forTrip: null,
  });

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const unsubscribe = onSnapshot(
      doc(firestore, 'shared_trips', tripId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          if (!cancelled) setState({ state: 'missing', trip: null, forTrip: tripId });
          return;
        }
        const data = snapshot.data() as Json;
        const payload = tripKey ? await decryptPayload(data, tripKey) : data;
        if (cancelled) return;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null;
        setState({
          state: 'ready',
          trip: parseTripSnapshot(payload, tripId, updatedAt),
          forTrip: tripId,
        });
      },
      (error) => {
        if (cancelled) return;
        // A revoked or expired session surfaces here first; the session
        // provider notices separately and swaps the whole screen out.
        setState({
          state: error.code === 'permission-denied' ? 'denied' : 'error',
          trip: null,
          forTrip: tripId,
        });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tripId, tripKey]);

  if (!tripId || state.forTrip !== tripId) return { state: 'loading', trip: null };
  return { state: state.state, trip: state.trip };
}

/**
 * Field-level writer for the trip header.
 *
 * Writes only the keys that changed, through dotted field paths, so a small
 * edit never rewrites the whole document. Before committing it compares each
 * field against the value this browser loaded: if the phone changed the same
 * field in the meantime the write is refused with a [TripConflictError]
 * instead of silently winning.
 */
export function useTripWriter() {
  const { active } = useSession();
  const tripId = active?.tripId ?? null;
  const canEdit = active?.canEdit === true;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const saveTripFields = useCallback(
    async (
      patch: Record<string, unknown>,
      baseline: Record<string, unknown>,
      options: { force?: boolean } = {},
    ) => {
      if (!tripId) throw new Error('No trip in this session');
      if (!canEdit) throw new Error('This session is read-only');

      await runTransaction(firestore, async (transaction) => {
        const ref = doc(firestore, 'shared_trips', tripId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error('Trip no longer exists');

        const remoteTrip = ((snapshot.data() as Json).tripData ?? {}) as Json;

        if (!options.force) {
          const conflicts = Object.keys(patch).filter((field) => {
            const remote = remoteTrip[field];
            // Only a *different* remote value conflicts. If the phone already
            // made the same change, there is nothing to argue about.
            return !sameValue(remote, baseline[field]) && !sameValue(remote, patch[field]);
          });
          if (conflicts.length > 0) throw new TripConflictError(conflicts, remoteTrip);
        }

        const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
        for (const [field, value] of Object.entries(patch)) {
          update[`tripData.${field}`] = value;
        }
        transaction.update(ref, update);
      });
    },
    [tripId, canEdit],
  );

  return useMemo(() => ({ canEdit, saveTripFields }), [canEdit, saveTripFields]);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}
