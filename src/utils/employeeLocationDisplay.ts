import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {EmployeeLastLocation} from '@app/types/models';

export const EMPLOYEE_LOCATION_STALE_MINUTES = 30;

export function isEmployeeLocationStale(
  location: EmployeeLastLocation | undefined,
  staleMinutes = EMPLOYEE_LOCATION_STALE_MINUTES,
): boolean {
  if (!location?.updatedAt) {
    return true;
  }

  return dayjs().diff(dayjs(location.updatedAt), 'minute') > staleMinutes;
}

export function formatEmployeeLocationUpdatedAt(
  location: EmployeeLastLocation | undefined,
  t: TFunction,
): string {
  if (!location) {
    return t('employeeLocationUnavailable');
  }

  if (isEmployeeLocationStale(location)) {
    return t('employeeLocationStale');
  }

  return t('employeeLocationUpdated', {
    time: dayjs(location.updatedAt).format('YYYY-MM-DD HH:mm'),
  });
}

export function buildEmployeeLocationMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
