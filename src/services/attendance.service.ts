import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  deleteField,
  type Unsubscribe,
} from 'firebase/firestore';
import dayjs from 'dayjs';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {subscribeMockDb, useMockDb} from '@app/mock/mockDb';
import type {AttendanceEventType, AttendanceRecord} from '@app/types/models';
import {combineAttendanceDateTime} from '@app/utils/attendanceReport';

const ATTENDANCE = 'attendance';

function mapAttendanceRecord(id: string, data: Record<string, unknown>): AttendanceRecord {
  const createdAt = data.createdAt;
  const createdAtStr =
    createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
      ? dayjs((createdAt as {toDate: () => Date}).toDate()).toISOString()
      : String(createdAt ?? '');

  return {
    id,
    userId: String(data.userId ?? ''),
    type: (data.type as AttendanceEventType) ?? 'check_in',
    createdAt: createdAtStr,
    note: data.note ? String(data.note) : undefined,
    resetTotalSeconds:
      data.resetTotalSeconds === undefined ? undefined : Number(data.resetTotalSeconds),
  };
}

function sortRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseCreatedAtMs(createdAt: unknown): number {
  if (typeof createdAt === 'string') {
    return dayjs(createdAt).valueOf();
  }
  if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
    return (createdAt as {toDate: () => Date}).toDate().getTime();
  }
  return 0;
}

async function resolveAttendanceCreatedAt(userId: string): Promise<string> {
  let latestMs = 0;

  try {
    const q = query(collection(getFirebaseDb(), ATTENDANCE), where('userId', '==', userId));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      latestMs = Math.max(latestMs, parseCreatedAtMs(docSnap.data().createdAt));
    }
  } catch (error) {
    console.warn('[resolveAttendanceCreatedAt]', error);
  }

  let createdAtMs = Date.now();
  if (latestMs > 0 && createdAtMs <= latestMs) {
    createdAtMs = latestMs + 1000;
  }

  return new Date(createdAtMs).toISOString();
}

export function subscribeToUserAttendance(
  userId: string,
  callback: (records: AttendanceRecord[]) => void,
): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      const list = sortRecords(
        useMockDb.getState().attendance.filter((record) => record.userId === userId),
      );
      callback(list);
    };
    emit();
    return subscribeMockDb(emit);
  }

  const q = query(collection(getFirebaseDb(), ATTENDANCE), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = sortRecords(snap.docs.map((doc) => mapAttendanceRecord(doc.id, doc.data())));
      callback(list);
    },
    (error) => {
      console.error('[subscribeToUserAttendance]', error);
      callback([]);
    },
  );
}

export function subscribeToAllAttendance(
  callback: (records: AttendanceRecord[]) => void,
): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      callback(sortRecords([...useMockDb.getState().attendance]));
    };
    emit();
    return subscribeMockDb(emit);
  }

  return onSnapshot(
    collection(getFirebaseDb(), ATTENDANCE),
    (snap) => {
      const list = sortRecords(snap.docs.map((doc) => mapAttendanceRecord(doc.id, doc.data())));
      callback(list);
    },
    (error) => {
      console.error('[subscribeToAllAttendance]', error);
      callback([]);
    },
  );
}

export async function createAttendanceRecord(
  userId: string,
  type: AttendanceEventType,
  note = '',
  options?: {createdAt?: string},
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().addAttendanceRecord(userId, type, note, options);
    return;
  }

  const createdAt = options?.createdAt ?? (await resolveAttendanceCreatedAt(userId));

  await addDoc(collection(getFirebaseDb(), ATTENDANCE), {
    userId,
    type,
    note,
    createdAt,
  });
}

export async function createHoursResetRecord(
  userId: string,
  createdAt: string,
  resetTotalSeconds: number,
  note: string,
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().addAttendanceRecord(userId, 'hours_reset', note, {
      createdAt,
      resetTotalSeconds,
    });
    return;
  }

  await addDoc(collection(getFirebaseDb(), ATTENDANCE), {
    userId,
    type: 'hours_reset',
    note,
    resetTotalSeconds,
    createdAt,
  });
}

export async function updateAttendanceRecord(
  recordId: string,
  updates: Partial<Pick<AttendanceRecord, 'type' | 'createdAt' | 'note' | 'resetTotalSeconds'>>,
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().updateAttendanceRecord(recordId, updates);
    return;
  }

  const payload: Record<string, unknown> = {};
  if (updates.type !== undefined) {
    payload.type = updates.type;
  }
  if (updates.createdAt !== undefined) {
    payload.createdAt = updates.createdAt;
  }
  if (updates.resetTotalSeconds !== undefined) {
    payload.resetTotalSeconds = updates.resetTotalSeconds;
  }
  if (updates.note !== undefined) {
    payload.note = updates.note.trim() ? updates.note.trim() : deleteField();
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  await updateDoc(doc(getFirebaseDb(), ATTENDANCE, recordId), payload);
}

export async function deleteAttendanceRecord(recordId: string): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().deleteAttendanceRecord(recordId);
    return;
  }

  await deleteDoc(doc(getFirebaseDb(), ATTENDANCE, recordId));
}

export async function deleteAllAttendanceRecordsForUser(userId: string): Promise<number> {
  if (isMockMode) {
    let removed = 0;
    useMockDb.setState((state) => {
      const nextAttendance = state.attendance.filter((record) => record.userId !== userId);
      removed = state.attendance.length - nextAttendance.length;
      return {attendance: nextAttendance};
    });
    return removed;
  }

  const snap = await getDocs(
    query(collection(getFirebaseDb(), ATTENDANCE), where('userId', '==', userId)),
  );
  if (snap.empty) {
    return 0;
  }

  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  return snap.size;
}

export async function deleteAllAttendanceRecords(): Promise<number> {
  if (isMockMode) {
    const count = useMockDb.getState().attendance.length;
    useMockDb.setState({attendance: []});
    return count;
  }

  const snap = await getDocs(collection(getFirebaseDb(), ATTENDANCE));
  if (snap.empty) {
    return 0;
  }

  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  return snap.size;
}

function getDayWorkRecordIds(dateKey: string, existingRecords: AttendanceRecord[]): string[] {
  return existingRecords
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === dateKey,
    )
    .map((record) => record.id);
}

export async function clearDayAttendanceRecords(
  dateKey: string,
  existingRecords: AttendanceRecord[],
): Promise<void> {
  for (const recordId of getDayWorkRecordIds(dateKey, existingRecords)) {
    await deleteAttendanceRecord(recordId);
  }
}

export async function replaceDayAttendanceRecords(
  userId: string,
  dateKey: string,
  session: {checkInTime: string; checkOutTime?: string; note?: string},
  existingRecords: AttendanceRecord[],
): Promise<void> {
  await clearDayAttendanceRecords(dateKey, existingRecords);

  const note = session.note?.trim() ?? '';
  const checkInIso = combineAttendanceDateTime(dateKey, session.checkInTime);
  await createAttendanceRecord(userId, 'check_in', note, {createdAt: checkInIso});

  if (session.checkOutTime?.trim()) {
    const checkOutIso = combineAttendanceDateTime(dateKey, session.checkOutTime.trim());
    await createAttendanceRecord(userId, 'check_out', note, {createdAt: checkOutIso});
  }
}
