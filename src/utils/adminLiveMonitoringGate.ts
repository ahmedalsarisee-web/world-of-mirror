type Listener = () => void;

let liveMonitoringEnabled = false;
const listeners = new Set<Listener>();

/** Whether admin live Firestore monitoring (finance/attendance alerts) may run. */
export function isAdminLiveMonitoringEnabled(): boolean {
  return liveMonitoringEnabled;
}

export function enableAdminLiveMonitoring(): void {
  if (liveMonitoringEnabled) {
    return;
  }
  liveMonitoringEnabled = true;
  listeners.forEach((listener) => listener());
}

export function subscribeAdminLiveMonitoringEnabled(listener: Listener): () => void {
  listeners.add(listener);
  if (liveMonitoringEnabled) {
    listener();
  }
  return () => {
    listeners.delete(listener);
  };
}
