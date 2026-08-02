export function subscribeOnce<T>(
  subscribe: (callback: (data: T) => void) => (() => void) | void,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      unsub?.();
      reject(new Error('SUBSCRIPTION_TIMEOUT'));
    }, timeoutMs);

    const unsub = subscribe((data) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      unsub?.();
      resolve(data);
    });
  });
}
