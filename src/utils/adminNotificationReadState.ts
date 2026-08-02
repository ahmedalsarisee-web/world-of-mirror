import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'admin-notification-read-ids-v1';
const MAX_PERSISTED_READ_IDS = 2000;

const readIds = new Set<string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (!hydrated) {
    return;
  }
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistReadIds();
  }, 250);
}

async function persistReadIds(): Promise<void> {
  if (!hydrated) {
    return;
  }
  try {
    const ids = [...readIds].slice(-MAX_PERSISTED_READ_IDS);
    if (ids.length !== readIds.size) {
      readIds.clear();
      for (const id of ids) {
        readIds.add(id);
      }
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('[adminNotificationReadState] persist failed', error);
  }
}

export async function hydrateAdminNotificationReadState(): Promise<void> {
  if (hydrated) {
    return;
  }
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw?.trim()) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (typeof entry === 'string' && entry.length > 0) {
              readIds.add(entry);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[adminNotificationReadState] hydrate failed', error);
    } finally {
      hydrated = true;
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function isAdminNotificationRead(id: string): boolean {
  return readIds.has(id);
}

export function markAdminNotificationRead(id: string): void {
  if (!id || readIds.has(id)) {
    return;
  }
  readIds.add(id);
  schedulePersist();
}

export function markAdminNotificationsRead(ids: Iterable<string>): void {
  let changed = false;
  for (const id of ids) {
    if (!id || readIds.has(id)) {
      continue;
    }
    readIds.add(id);
    changed = true;
  }
  if (changed) {
    schedulePersist();
  }
}

export function clearAdminNotificationReadState(): void {
  if (readIds.size === 0) {
    hydrated = true;
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    return;
  }
  readIds.clear();
  hydrated = true;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function resolveAdminNotificationReadState(
  id: string,
  fallbackRead = false,
): boolean {
  return readIds.has(id) || fallbackRead;
}
