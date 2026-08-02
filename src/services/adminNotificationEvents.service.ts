import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {deleteAllDocumentsInCollection} from '@app/utils/firestoreBatchDelete';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import type {AdminNotificationKind} from '@app/stores/adminNotificationStore';
import type {AdminNotificationMetadata} from '@app/types/adminNotificationMetadata';
import type {
  AdminNotificationEvent,
  PersistAdminNotificationEventInput,
} from '@app/types/adminNotificationEvent';

const COLLECTION = 'adminNotificationEvents';
const SHARED_SETTINGS_DOC = 'sharedNotifications';
const SETTINGS_COLLECTION = 'appSettings';
/** Page size for the notifications list (initial load + pagination). */
export const ADMIN_NOTIFICATION_PAGE_SIZE = 5;
/** Max newer notifications fetched in one delta/listener batch (matches page size). */
const ADMIN_NOTIFICATION_NEWER_BATCH_LIMIT = ADMIN_NOTIFICATION_PAGE_SIZE;
/** Legacy cap for optimistic local inserts only. */
export const ADMIN_NOTIFICATION_HISTORY_LIMIT = 500;

let sharedLogClearedAtMs = 0;
let sharedLogClearedAtFetchedAt = 0;
const SHARED_LOG_CLEARED_TTL_MS = 60_000;

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as {code?: string}).code;
  return code === 'permission-denied';
}

function parseSharedLogClearedAtMs(data: Record<string, unknown> | undefined): number {
  if (!data) {
    return 0;
  }
  const clearedAt = String(data.clearedAt ?? '').trim();
  if (!clearedAt) {
    return 0;
  }
  const parsed = Date.parse(clearedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function refreshSharedLogClearedAtMs(force = false): Promise<number> {
  if (isMockMode || !isFirebaseConfigured) {
    return 0;
  }

  if (!force && Date.now() - sharedLogClearedAtFetchedAt < SHARED_LOG_CLEARED_TTL_MS) {
    return sharedLogClearedAtMs;
  }

  try {
    const snap = await getDoc(doc(getFirebaseDb(), SETTINGS_COLLECTION, SHARED_SETTINGS_DOC));
    sharedLogClearedAtMs = parseSharedLogClearedAtMs(
      snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
    );
    sharedLogClearedAtFetchedAt = Date.now();
  } catch {
    // Keep the last known cutoff when settings cannot be read.
  }

  return sharedLogClearedAtMs;
}

function resolveOperationTimeMs(event: Pick<AdminNotificationEvent, 'eventAt' | 'recordedAt'>): number {
  const eventAtMs = Date.parse(event.eventAt);
  if (Number.isFinite(eventAtMs)) {
    return eventAtMs;
  }
  const recordedAtMs = Date.parse(event.recordedAt);
  return Number.isFinite(recordedAtMs) ? recordedAtMs : 0;
}

function isOperationAfterSharedClear(eventAtIso: string): boolean {
  if (sharedLogClearedAtMs <= 0) {
    return true;
  }
  const eventAtMs = Date.parse(eventAtIso);
  if (!Number.isFinite(eventAtMs)) {
    return false;
  }
  return eventAtMs > sharedLogClearedAtMs;
}

function isEventAfterSharedClear(event: Pick<AdminNotificationEvent, 'eventAt' | 'recordedAt'>): boolean {
  if (sharedLogClearedAtMs <= 0) {
    return true;
  }

  const recordedAtMs = Date.parse(event.recordedAt);
  if (Number.isFinite(recordedAtMs) && recordedAtMs > sharedLogClearedAtMs) {
    return true;
  }

  return isOperationAfterSharedClear(event.eventAt);
}

export function isNotificationEventVisible(eventAt?: number, recordedAt?: number): boolean {
  if (sharedLogClearedAtMs <= 0) {
    return true;
  }

  if (recordedAt !== undefined && recordedAt > sharedLogClearedAtMs) {
    return true;
  }

  if (eventAt === undefined) {
    return false;
  }

  return isOperationAfterSharedClear(new Date(eventAt).toISOString());
}

export function getSharedNotificationLogClearedAtMs(): number {
  return sharedLogClearedAtMs;
}

function filterEventsAfterSharedClear(events: AdminNotificationEvent[]): AdminNotificationEvent[] {
  return events.filter(isEventAfterSharedClear);
}

function mapAdminNotificationEvent(
  id: string,
  data: Record<string, unknown>,
): AdminNotificationEvent | null {
  const kind = data.kind;
  if (
    kind !== 'finance' &&
    kind !== 'attendance' &&
    kind !== 'confirmed_order' &&
    kind !== 'order_moved' &&
    kind !== 'order_updated' &&
    kind !== 'order_deleted' &&
    kind !== 'mirror_warehouse'
  ) {
    return null;
  }

  const title = String(data.title ?? '').trim();
  const body = String(data.body ?? '').trim();
  const sourceId = String(data.sourceId ?? id).trim();
  const eventAt = String(data.eventAt ?? data.recordedAt ?? new Date().toISOString());
  const recordedAt = String(data.recordedAt ?? eventAt);

  if (!title && !body) {
    return null;
  }

  return {
    id,
    kind,
    title,
    body,
    sourceId,
    eventAt,
    recordedAt,
    metadata: data.metadata as AdminNotificationMetadata | undefined,
    actorUserId: data.actorUserId ? String(data.actorUserId) : undefined,
    actorName: data.actorName ? String(data.actorName) : undefined,
    accountUserId: data.accountUserId ? String(data.accountUserId) : undefined,
    accountName: data.accountName ? String(data.accountName) : undefined,
  };
}

function mapSnapshotToEvents(
  snap: {docs: Array<{id: string; data: () => Record<string, unknown>}>},
): AdminNotificationEvent[] {
  return snap.docs
    .map((entry) => mapAdminNotificationEvent(entry.id, entry.data() as Record<string, unknown>))
    .filter((entry): entry is AdminNotificationEvent => entry !== null);
}

function buildHistoryPageQuery(
  pageSize: number,
  startAfterDoc?: DocumentSnapshot | null,
  startAfterRecordedAt?: string | null,
) {
  const collectionRef = collection(getFirebaseDb(), COLLECTION);

  if (startAfterDoc) {
    return query(collectionRef, orderBy('recordedAt', 'desc'), startAfter(startAfterDoc), limit(pageSize + 1));
  }

  if (startAfterRecordedAt?.trim()) {
    return query(
      collectionRef,
      orderBy('recordedAt', 'desc'),
      startAfter(startAfterRecordedAt.trim()),
      limit(pageSize + 1),
    );
  }

  return query(collectionRef, orderBy('recordedAt', 'desc'), limit(pageSize + 1));
}

function buildNewerThanQuery(afterRecordedAt: string) {
  return query(
    collection(getFirebaseDb(), COLLECTION),
    where('recordedAt', '>', afterRecordedAt),
    orderBy('recordedAt', 'desc'),
    limit(ADMIN_NOTIFICATION_NEWER_BATCH_LIMIT),
  );
}

export interface AdminNotificationEventsPage {
  events: AdminNotificationEvent[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function fetchAdminNotificationEventsPage(
  options: {
    pageSize?: number;
    startAfterDoc?: DocumentSnapshot | null;
    startAfterRecordedAt?: string | null;
  } = {},
): Promise<AdminNotificationEventsPage> {
  if (isMockMode || !isFirebaseConfigured) {
    return {events: [], lastDoc: null, hasMore: false};
  }

  const pageSize = options.pageSize ?? ADMIN_NOTIFICATION_PAGE_SIZE;

  try {
    await refreshSharedLogClearedAtMs();
    const snap = await getDocs(
      buildHistoryPageQuery(pageSize, options.startAfterDoc, options.startAfterRecordedAt),
    );
    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const events = filterEventsAfterSharedClear(
      sortAdminNotificationEventsByRecordedAtDesc(mapSnapshotToEvents({docs: pageDocs})),
    );

    return {
      events,
      lastDoc: pageDocs[pageDocs.length - 1] ?? null,
      hasMore,
    };
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.warn('[adminNotificationEvents] Page read access denied');
      return {events: [], lastDoc: null, hasMore: false};
    }
    throw error;
  }
}

export async function fetchAdminNotificationsNewerThan(
  afterRecordedAt: string,
): Promise<AdminNotificationEvent[]> {
  if (isMockMode || !isFirebaseConfigured || !afterRecordedAt.trim()) {
    return [];
  }

  try {
    await refreshSharedLogClearedAtMs();
    const snap = await getDocs(buildNewerThanQuery(afterRecordedAt));
    return filterEventsAfterSharedClear(
      sortAdminNotificationEventsNewestFirst(mapSnapshotToEvents(snap)),
    );
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.warn('[adminNotificationEvents] Newer-than read access denied');
      return [];
    }
    throw error;
  }
}

/** @deprecated Use fetchAdminNotificationEventsPage — loads only the first page. */
export async function fetchAdminNotificationEvents(): Promise<AdminNotificationEvent[]> {
  const page = await fetchAdminNotificationEventsPage();
  return page.events;
}

/** Matches `notificationSortTime` in adminNotificationStore — keep both in sync. */
export function adminNotificationEventSortTime(
  event: Pick<AdminNotificationEvent, 'eventAt' | 'recordedAt'>,
): number {
  const eventAtMs = Date.parse(event.eventAt);
  const recordedAtMs = Date.parse(event.recordedAt);
  const eventAt = Number.isFinite(eventAtMs) ? eventAtMs : 0;
  const recordedAt = Number.isFinite(recordedAtMs) ? recordedAtMs : 0;
  return Math.max(eventAt, recordedAt);
}

export function sortAdminNotificationEventsForDisplay(
  events: AdminNotificationEvent[],
): AdminNotificationEvent[] {
  return [...events].sort((left, right) => {
    const sortDiff =
      adminNotificationEventSortTime(right) - adminNotificationEventSortTime(left);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    const recordedCmp = right.recordedAt.localeCompare(left.recordedAt);
    if (recordedCmp !== 0) {
      return recordedCmp;
    }
    return right.id.localeCompare(left.id);
  });
}

export function sortAdminNotificationEventsNewestFirst(
  events: AdminNotificationEvent[],
): AdminNotificationEvent[] {
  return sortAdminNotificationEventsForDisplay(events);
}

/** List pagination order — matches Firestore `orderBy('recordedAt', 'desc')`. */
export function sortAdminNotificationEventsByRecordedAtDesc(
  events: AdminNotificationEvent[],
): AdminNotificationEvent[] {
  return [...events].sort((left, right) => {
    const cmp = right.recordedAt.localeCompare(left.recordedAt);
    if (cmp !== 0) {
      return cmp;
    }
    return right.id.localeCompare(left.id);
  });
}

export function mapAdminNotificationEventToStoreItem(event: AdminNotificationEvent): {
  id: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
  eventAt?: number;
  metadata?: AdminNotificationMetadata;
  recordedAt: number;
} {
  const eventAtMs = Date.parse(event.eventAt);
  const recordedAtMs = Date.parse(event.recordedAt);
  return {
    id: event.id,
    title: event.title,
    body: event.body,
    kind: event.kind,
    eventAt: Number.isFinite(eventAtMs) ? eventAtMs : undefined,
    metadata: event.metadata,
    recordedAt: Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now(),
  };
}

export function buildAdminNotificationEventId(kind: AdminNotificationKind, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

export async function persistAdminNotificationEvent(
  input: PersistAdminNotificationEventInput,
): Promise<boolean> {
  if (isMockMode || !isFirebaseConfigured) {
    return false;
  }

  await refreshSharedLogClearedAtMs();

  const recordedAt = new Date().toISOString();
  const eventAt = input.eventAt
    ? new Date(input.eventAt).toISOString()
    : recordedAt;

  if (!isOperationAfterSharedClear(eventAt)) {
    return false;
  }

  try {
    await setDoc(
      doc(getFirebaseDb(), COLLECTION, input.id),
      toFirestoreSafePayload({
        kind: input.kind,
        title: input.title,
        body: input.body,
        sourceId: input.sourceId,
        eventAt,
        recordedAt,
        ...(input.metadata ? {metadata: input.metadata} : {}),
        ...(input.actorUserId ? {actorUserId: input.actorUserId} : {}),
        ...(input.actorName ? {actorName: input.actorName} : {}),
        ...(input.accountUserId ? {accountUserId: input.accountUserId} : {}),
        ...(input.accountName ? {accountName: input.accountName} : {}),
      }),
      {merge: false},
    );
    return true;
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.warn('[adminNotificationEvents] Write access denied');
      return false;
    }
    throw error;
  }
}

export async function clearSharedNotificationEvents(): Promise<number> {
  if (isMockMode || !isFirebaseConfigured) {
    return 0;
  }

  const clearedAt = new Date().toISOString();
  sharedLogClearedAtMs = Date.parse(clearedAt);

  try {
    await setDoc(
      doc(getFirebaseDb(), SETTINGS_COLLECTION, SHARED_SETTINGS_DOC),
      {clearedAt},
      {merge: true},
    );
    const deletedCount = await deleteAllDocumentsInCollection(COLLECTION);

    const remaining = await getDocs(collection(getFirebaseDb(), COLLECTION));
    if (!remaining.empty) {
      throw new Error(`Notification clear incomplete: ${remaining.size} documents remain`);
    }

    return deletedCount;
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.warn('[adminNotificationEvents] Clear denied — primary admin only');
      throw error;
    }
    throw error;
  }
}

export function subscribeToAdminNotificationsNewerThan(
  afterRecordedAt: string,
  callback: (events: AdminNotificationEvent[]) => void,
): Unsubscribe {
  if (isMockMode || !isFirebaseConfigured || !afterRecordedAt.trim()) {
    return () => undefined;
  }

  return onSnapshot(
    buildNewerThanQuery(afterRecordedAt),
    (snap) => {
      const events = filterEventsAfterSharedClear(
        sortAdminNotificationEventsNewestFirst(mapSnapshotToEvents(snap)),
      );
      callback(events);
    },
    (error) => {
      if (isPermissionDenied(error)) {
        console.warn('[adminNotificationEvents] Newer-than subscription denied');
      } else {
        console.error('[subscribeToAdminNotificationsNewerThan]', error);
      }
      callback([]);
    },
  );
}

export function subscribeToSharedNotificationLogSettings(
  onClearedAtChange: (clearedAtMs: number) => void,
): Unsubscribe {
  if (isMockMode || !isFirebaseConfigured) {
    void refreshSharedLogClearedAtMs().then(onClearedAtChange);
    return () => undefined;
  }

  void refreshSharedLogClearedAtMs().then(onClearedAtChange);

  return onSnapshot(
    doc(getFirebaseDb(), SETTINGS_COLLECTION, SHARED_SETTINGS_DOC),
    (snap) => {
      sharedLogClearedAtMs = parseSharedLogClearedAtMs(
        snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
      );
      sharedLogClearedAtFetchedAt = Date.now();
      onClearedAtChange(sharedLogClearedAtMs);
    },
    (error) => {
      if (!isPermissionDenied(error)) {
        console.error('[subscribeToSharedNotificationLogSettings]', error);
      }
    },
  );
}

/** @deprecated Use subscribeToAdminNotificationsNewerThan after the list cache is hydrated. */
export function subscribeToAdminNotificationEvents(
  callback: (events: AdminNotificationEvent[]) => void,
): Unsubscribe {
  return subscribeToAdminNotificationsNewerThan('1970-01-01T00:00:00.000Z', callback);
}
