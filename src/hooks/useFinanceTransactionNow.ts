import {useEffect, useState} from 'react';

/** Keeps transaction edit-window badges in sync as the one-hour grace period expires. */
export function useFinanceTransactionNow(refreshMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(intervalId);
  }, [refreshMs]);

  return now;
}
