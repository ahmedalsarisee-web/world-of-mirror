import {FieldValue, getFirestore, Timestamp} from 'firebase-admin/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';

const db = getFirestore();
const HEARTBEAT_STALE_MS = 60_000;
const CHECKOUT_NOTE = 'انصراف تلقائي — تم إيقاف GPS أو إغلاق التطبيق';

function parseCreatedAtMs(createdAt: unknown): number {
  if (typeof createdAt === 'string') {
    const ms = Date.parse(createdAt);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (createdAt instanceof Timestamp) {
    return createdAt.toMillis();
  }
  if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
    return (createdAt as {toDate: () => Date}).toDate().getTime();
  }
  return 0;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isGpsLinked(permissions: unknown): boolean {
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }
  return Boolean((permissions as {attendanceGpsLinked?: boolean}).attendanceGpsLinked);
}

async function isPresentToday(userId: string): Promise<boolean> {
  const snap = await db.collection('attendance').where('userId', '==', userId).get();
  const day = todayKey();

  const todayRecords = snap.docs
    .map((doc) => doc.data())
    .filter((record) => {
      const type = String(record.type ?? '');
      if (type !== 'check_in' && type !== 'check_out') {
        return false;
      }
      const createdAtMs = parseCreatedAtMs(record.createdAt);
      if (!createdAtMs) {
        return false;
      }
      return new Date(createdAtMs).toISOString().slice(0, 10) === day;
    })
    .sort((a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt));

  if (!todayRecords.length) {
    return false;
  }

  return String(todayRecords[0].type) === 'check_in';
}

async function createAutoCheckOut(userId: string): Promise<void> {
  await db.collection('attendance').add({
    userId,
    type: 'check_out',
    note: CHECKOUT_NOTE,
    createdAt: new Date().toISOString(),
  });
}

export const enforceAttendanceGpsStaleHeartbeat = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Amman',
  },
  async () => {
    const employeesSnap = await db.collection('users').where('role', '==', 'employee').get();
    const now = Date.now();

    for (const employeeDoc of employeesSnap.docs) {
      const data = employeeDoc.data();
      if (!isGpsLinked(data.permissions)) {
        continue;
      }

      const userId = employeeDoc.id;
      if (!(await isPresentToday(userId))) {
        continue;
      }

      const heartbeatAt = data.attendanceGpsHeartbeatAt;
      const heartbeatMs =
        typeof heartbeatAt === 'string' ? Date.parse(heartbeatAt) : Number.NaN;
      const isStale = !Number.isFinite(heartbeatMs) || now - heartbeatMs > HEARTBEAT_STALE_MS;

      if (!isStale) {
        continue;
      }

      await createAutoCheckOut(userId);
      await employeeDoc.ref.update({attendanceGpsHeartbeatAt: FieldValue.delete()});
    }
  },
);
