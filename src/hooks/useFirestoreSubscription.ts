import {useEffect, useState} from 'react';

interface Options {
  enabled?: boolean;
}

export function useFirestoreSubscription<T>(
  initialValue: T,
  subscribe: (callback: (data: T) => void) => (() => void) | void,
  deps: unknown[] = [],
  options?: Options,
): {data: T; isLoading: boolean} {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData(initialValue);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    const finish = (value: T) => {
      if (!active) {
        return;
      }
      setData(value);
      setIsLoading(false);
    };

    let unsub: (() => void) | void;

    try {
      unsub = subscribe(finish);
    } catch (error) {
      console.error('[useFirestoreSubscription]', error);
      finish(initialValue);
    }

    const timeout = setTimeout(() => {
      if (active) {
        setIsLoading(false);
      }
    }, 12000);

    return () => {
      active = false;
      clearTimeout(timeout);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return {data, isLoading};
}
