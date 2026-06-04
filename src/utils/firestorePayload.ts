/** Firestore rejects `undefined` field values — strip them before writes. */
export function toFirestoreSafePayload<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toFirestoreSafePayload(entry)) as T;
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(record)) {
      if (entry === undefined) {
        continue;
      }
      next[key] = toFirestoreSafePayload(entry);
    }

    return next as T;
  }

  return value;
}
