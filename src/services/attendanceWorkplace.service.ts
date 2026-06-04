import {doc, onSnapshot, setDoc, type Unsubscribe} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {DEFAULT_ATTENDANCE_WORKPLACE} from '@app/constants/attendanceLocation';
import {useMockDb} from '@app/mock/mockDb';
import type {AttendanceWorkplace} from '@app/types/models';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';

const APP_SETTINGS = 'appSettings';
const ATTENDANCE_WORKPLACE_DOC_ID = 'attendanceWorkplace';

function clampRadiusMeters(value: number): number {
  return Math.min(500, Math.max(30, Math.round(value)));
}

function mapAttendanceWorkplace(data: Record<string, unknown>): AttendanceWorkplace {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const radiusMeters = clampRadiusMeters(Number(data.radiusMeters ?? DEFAULT_ATTENDANCE_WORKPLACE.radiusMeters));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return DEFAULT_ATTENDANCE_WORKPLACE;
  }

  const name = String(data.name ?? DEFAULT_ATTENDANCE_WORKPLACE.name).trim();

  return {
    name: name.length > 0 ? name : DEFAULT_ATTENDANCE_WORKPLACE.name,
    latitude,
    longitude,
    radiusMeters,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    updatedByUserId: data.updatedByUserId ? String(data.updatedByUserId) : undefined,
  };
}

export function subscribeToAttendanceWorkplace(
  callback: (workplace: AttendanceWorkplace) => void,
): Unsubscribe {
  if (isMockMode) {
    callback(useMockDb.getState().attendanceWorkplace ?? DEFAULT_ATTENDANCE_WORKPLACE);
    return useMockDb.subscribe((state) => {
      callback(state.attendanceWorkplace ?? DEFAULT_ATTENDANCE_WORKPLACE);
    });
  }

  const docRef = doc(getFirebaseDb(), APP_SETTINGS, ATTENDANCE_WORKPLACE_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_ATTENDANCE_WORKPLACE);
        return;
      }
      callback(mapAttendanceWorkplace(snap.data() as Record<string, unknown>));
    },
    () => {
      callback(DEFAULT_ATTENDANCE_WORKPLACE);
    },
  );
}

export async function saveAttendanceWorkplace(
  workplace: Pick<AttendanceWorkplace, 'name' | 'latitude' | 'longitude' | 'radiusMeters'>,
  updatedByUserId: string,
): Promise<void> {
  const payload: AttendanceWorkplace = {
    name: workplace.name.trim() || DEFAULT_ATTENDANCE_WORKPLACE.name,
    latitude: workplace.latitude,
    longitude: workplace.longitude,
    radiusMeters: clampRadiusMeters(workplace.radiusMeters),
    updatedAt: new Date().toISOString(),
    updatedByUserId,
  };

  if (isMockMode) {
    useMockDb.getState().setAttendanceWorkplace(payload);
    return;
  }

  await setDoc(
    doc(getFirebaseDb(), APP_SETTINGS, ATTENDANCE_WORKPLACE_DOC_ID),
    toFirestoreSafePayload(payload),
    {merge: true},
  );
}
