import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import type {AttendanceRecord} from '@app/types/models';

const EMPTY_RECORDS: AttendanceRecord[] = [];

interface UserPool {
  records: AttendanceRecord[];
  refs: number;
  ready: boolean;
  unsubscribe?: () => void;
}

const pools = new Map<string, UserPool>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function acquire(userId: string): void {
  let pool = pools.get(userId);
  if (!pool) {
    pool = {records: EMPTY_RECORDS, refs: 0, ready: false};
    pools.set(userId, pool);
  }

  pool.refs += 1;
  if (pool.refs !== 1) {
    return;
  }

  pool.unsubscribe = subscribeToUserAttendance(userId, (records) => {
    pool!.records = records;
    pool!.ready = true;
    notify();
  });
}

function release(userId: string): void {
  const pool = pools.get(userId);
  if (!pool) {
    return;
  }

  pool.refs = Math.max(0, pool.refs - 1);
  if (pool.refs !== 0) {
    return;
  }

  pool.unsubscribe?.();
  pool.unsubscribe = undefined;
  pool.records = EMPTY_RECORDS;
  pool.ready = false;
  pools.delete(userId);
  notify();
}

function getRecordsSnapshot(userId: string): AttendanceRecord[] {
  return pools.get(userId)?.records ?? EMPTY_RECORDS;
}

function getEmptySnapshot(): AttendanceRecord[] {
  return EMPTY_RECORDS;
}

/** Shared per-user attendance listener (refcounted). */
export function useUserAttendanceDirectory(
  userId: string,
  enabled = true,
): {records: AttendanceRecord[]; isLoading: boolean} {
  const activeUserIdRef = useRef('');
  activeUserIdRef.current = enabled && userId ? userId : '';

  const getSnapshot = useCallback(() => {
    const id = activeUserIdRef.current;
    return id ? getRecordsSnapshot(id) : getEmptySnapshot();
  }, []);

  const records = useSyncExternalStore(subscribe, getSnapshot, getEmptySnapshot);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }
    acquire(userId);
    return () => release(userId);
  }, [enabled, userId]);

  const isLoading = enabled && Boolean(userId) && !pools.get(userId)?.ready;

  return {records, isLoading};
}
