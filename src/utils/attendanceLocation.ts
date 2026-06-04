import * as Location from 'expo-location';
import {Platform} from 'react-native';
import {getAttendanceWorkplace} from '@app/utils/attendanceWorkplace';
import {isMockMode} from '@app/config/appMode';
import {readCurrentPositionSafe, runExclusiveLocationTask} from '@app/utils/locationCoordinator';

export interface AttendanceLocationCheck {
  allowed: boolean;
  distanceMeters?: number;
  reason?: 'permission_denied' | 'services_disabled' | 'out_of_range' | 'unavailable';
}

export interface CheckInLocationRequirements {
  workplace?: boolean;
  gps?: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ensureLocationServicesAndPermission(): Promise<AttendanceLocationCheck | null> {
  return runExclusiveLocationTask(async () => {
    const providerStatus = await Location.getProviderStatusAsync();
    if (!providerStatus.locationServicesEnabled) {
      return {allowed: false, reason: 'services_disabled'};
    }

    if (Platform.OS === 'android' && providerStatus.gpsAvailable === false) {
      return {allowed: false, reason: 'services_disabled'};
    }

    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== 'granted') {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return {allowed: false, reason: 'permission_denied'};
      }
    }

    return null;
  });
}

export async function verifyDeviceLocationEnabled(): Promise<AttendanceLocationCheck> {
  const gate = await ensureLocationServicesAndPermission();
  if (gate) {
    return gate;
  }

  const position = await readCurrentPositionSafe();
  if (!position) {
    return {allowed: false, reason: 'unavailable'};
  }

  return {allowed: true};
}

export async function verifyWorkplaceCheckInLocation(): Promise<AttendanceLocationCheck> {
  return verifyCheckInLocationRequirements({workplace: true});
}

export async function verifyCheckInLocationRequirements(
  requirements: CheckInLocationRequirements,
): Promise<AttendanceLocationCheck> {
  const needsWorkplace = Boolean(requirements.workplace);
  const needsGps = Boolean(requirements.gps);

  if (!needsWorkplace && !needsGps) {
    return {allowed: true};
  }

  if (isMockMode && needsGps && !needsWorkplace) {
    return {allowed: true};
  }

  const gate = await ensureLocationServicesAndPermission();
  if (gate) {
    return gate;
  }

  const position = await readCurrentPositionSafe();
  if (!position) {
    return {allowed: false, reason: 'unavailable'};
  }

  const workplace = getAttendanceWorkplace();

  if (needsWorkplace) {
    const distanceMeters = getDistanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      workplace.latitude,
      workplace.longitude,
    );

    if (distanceMeters > workplace.radiusMeters) {
      return {allowed: false, reason: 'out_of_range', distanceMeters};
    }
  }

  const distanceMeters = needsWorkplace
    ? getDistanceMeters(
        position.coords.latitude,
        position.coords.longitude,
        workplace.latitude,
        workplace.longitude,
      )
    : undefined;

  return {allowed: true, distanceMeters};
}
