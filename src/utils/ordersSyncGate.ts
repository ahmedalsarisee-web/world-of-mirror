type Listener = () => void;

let backgroundSyncEnabled = false;
const listeners = new Set<Listener>();

/** Whether confirmed-order Firestore sync / migration may run. */
export function isOrdersBackgroundSyncEnabled(): boolean {
  return backgroundSyncEnabled;
}

/** Turn on order sync (idempotent). Call when opening orders or after a startup delay. */
export function enableOrdersBackgroundSync(): void {
  if (backgroundSyncEnabled) {
    return;
  }
  backgroundSyncEnabled = true;
  listeners.forEach((listener) => listener());
}

export function subscribeOrdersBackgroundSyncEnabled(listener: Listener): () => void {
  listeners.add(listener);
  if (backgroundSyncEnabled) {
    listener();
  }
  return () => {
    listeners.delete(listener);
  };
}
