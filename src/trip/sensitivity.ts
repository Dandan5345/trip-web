/**
 * Mirror of `lib/services/data_sensitivity_service.dart`.
 *
 * Secure-share trips keep their sensitive fields encrypted inside the same
 * `shared_trips/{tripId}` document, flagged by `_encrypted: true`. The field
 * sets below must stay identical to the Dart ones or the two clients will
 * disagree about what is ciphertext.
 */
import { Te2Error, decryptField, encryptField } from '../crypto/te2';

export type Json = Record<string, unknown>;

const BASE_SENSITIVE_FIELDS = [
  'notes',
  'bookingLink',
  'totalPrice',
  'paymentStatus',
  'amountPaid',
  '_sharedConfirmation',
] as const;

const SUBTYPE_SENSITIVE_FIELDS: Record<string, readonly string[]> = {
  flight: ['flightNumber', 'seatNumbers', 'seatClass'],
  ride: ['driverName', 'driverPhone'],
  hotel: ['address', 'lat', 'lon'],
};

const NOTE_SENSITIVE_FIELDS = ['content', 'title'] as const;
const DOCUMENT_SENSITIVE_FIELDS = ['name', 'description'] as const;
const BOOKING_SENSITIVE_FIELDS = ['additionalDetails', 'price', 'orderNumber'] as const;

const NUMERIC_LOGISTICS_FIELDS = new Set(['totalPrice', 'amountPaid', 'lat', 'lon']);
const NUMERIC_BOOKING_FIELDS = new Set(['price']);

export function sensitiveFieldsFor(mainType?: unknown, subType?: unknown): string[] {
  const fields = new Set<string>(BASE_SENSITIVE_FIELDS);
  if (typeof subType === 'string' && SUBTYPE_SENSITIVE_FIELDS[subType]) {
    for (const field of SUBTYPE_SENSITIVE_FIELDS[subType]) fields.add(field);
  }
  // Hotels carry mainType 'hotel' rather than a subType.
  if (mainType === 'hotel') {
    for (const field of SUBTYPE_SENSITIVE_FIELDS.hotel) fields.add(field);
  }
  return [...fields];
}

function coerce(field: string, value: string, numericFields: Set<string>): unknown {
  if (!numericFields.has(field)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : value;
}

async function decryptItem(
  item: Json,
  fields: string[],
  key: string,
  numericFields: Set<string>,
): Promise<Json> {
  if (item._encrypted !== true) return item;
  const result: Json = { ...item };
  let allDecrypted = true;
  for (const field of fields) {
    const value = result[field];
    if (typeof value !== 'string' || value.length === 0) continue;
    try {
      result[field] = coerce(field, await decryptField(value, key), numericFields);
    } catch (error) {
      if (!(error instanceof Te2Error)) throw error;
      // Keep the ciphertext and the flag: never show a broken string, and
      // never let it be re-encrypted on top of itself.
      allDecrypted = false;
    }
  }
  if (allDecrypted) delete result._encrypted;
  return result;
}

async function encryptItem(item: Json, fields: string[], key: string): Promise<Json> {
  if (item._encrypted === true) return item;
  const result: Json = { ...item };
  let didEncrypt = false;
  for (const field of fields) {
    const value = result[field];
    if (value === null || value === undefined) continue;
    const text = String(value);
    // `package:encrypt`'s padded block cipher throws on zero-length input, so
    // the app cannot round-trip an empty encrypted field. Leave it alone
    // rather than write something the phone would choke on.
    if (text.length === 0) continue;
    result[field] = await encryptField(text, key);
    didEncrypt = true;
  }
  if (didEncrypt) result._encrypted = true;
  return result;
}

async function mapList(
  value: unknown,
  transform: (item: Json) => Promise<Json>,
): Promise<unknown> {
  if (!Array.isArray(value)) return value;
  return Promise.all(
    value.map((item) =>
      item && typeof item === 'object' ? transform(item as Json) : Promise.resolve(item),
    ),
  );
}

export async function decryptPayload(payload: Json, key: string): Promise<Json> {
  const result: Json = { ...payload };
  result.logisticsData = await mapList(result.logisticsData, (item) =>
    decryptItem(
      item,
      sensitiveFieldsFor(item.mainType, item.subType),
      key,
      NUMERIC_LOGISTICS_FIELDS,
    ),
  );
  result.notesData = await mapList(result.notesData, (item) =>
    decryptItem(item, [...NOTE_SENSITIVE_FIELDS], key, new Set()),
  );
  result.bookingConfirmationsData = await mapList(result.bookingConfirmationsData, (item) =>
    decryptItem(item, [...BOOKING_SENSITIVE_FIELDS], key, NUMERIC_BOOKING_FIELDS),
  );
  result.documentsData = await mapList(result.documentsData, (item) =>
    decryptItem(item, [...DOCUMENT_SENSITIVE_FIELDS], key, new Set()),
  );
  return result;
}

export async function encryptPayload(payload: Json, key: string): Promise<Json> {
  const result: Json = { ...payload };
  result.logisticsData = await mapList(result.logisticsData, (item) =>
    encryptItem(item, sensitiveFieldsFor(item.mainType, item.subType), key),
  );
  result.notesData = await mapList(result.notesData, (item) =>
    encryptItem(item, [...NOTE_SENSITIVE_FIELDS], key),
  );
  result.bookingConfirmationsData = await mapList(result.bookingConfirmationsData, (item) =>
    encryptItem(item, [...BOOKING_SENSITIVE_FIELDS], key),
  );
  result.documentsData = await mapList(result.documentsData, (item) =>
    encryptItem(item, [...DOCUMENT_SENSITIVE_FIELDS], key),
  );
  return result;
}

/** Encrypt a single item of a known kind — used when the web client saves. */
export async function encryptLogisticsItem(item: Json, key: string): Promise<Json> {
  return encryptItem(item, sensitiveFieldsFor(item.mainType, item.subType), key);
}

export async function encryptNoteItem(item: Json, key: string): Promise<Json> {
  return encryptItem(item, [...NOTE_SENSITIVE_FIELDS], key);
}
