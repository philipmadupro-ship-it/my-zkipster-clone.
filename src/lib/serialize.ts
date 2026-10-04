import { Timestamp } from 'firebase-admin/firestore';

/**
 * Makes Firestore data safe to send as JSON. Timestamps become
 * `{ seconds, nanoseconds }`, the same shape the dashboard already reads.
 */
export function serializeFirestore<T = unknown>(value: unknown): T {
  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds } as T;
  }
  if (Array.isArray(value)) return value.map((v) => serializeFirestore(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeFirestore(v)])) as T;
  }
  return value as T;
}

/** Newest first, by a Firestore timestamp field (missing values sort last). */
export function newestFirst<T extends Record<string, any>>(items: T[], field: string): T[] {
  const seconds = (item: T) => Number(item[field]?.seconds ?? 0);
  return [...items].sort((a, b) => seconds(b) - seconds(a));
}
