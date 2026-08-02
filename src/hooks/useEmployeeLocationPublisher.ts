import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import * as Location from 'expo-location';
import {isMockMode} from '@app/config/appMode';
import {getAttendanceWorkplace} from '@app/utils/attendanceWorkplace';
import {updateEmployeeLastLocation} from '@app/services/employeeLocation.service';
import {getDistanceMeters} from '@app/utils/attendanceLocation';
import {readCurrentPositionSafe} from '@app/utils/locationCoordinator';

const MIN_PUBLISH_INTERVAL_MS = 60_000;
const MIN_DISTANCE_METERS = 25;

function buildLocationPayload(position: Location.LocationObject) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    updatedAt: new Date().toISOString(),
    ...(position.coords.accuracy != null ? {accuracy: position.coords.accuracy} : {}),
  };
}

async function publishMockLocation(userId: string): Promise<void> {
  const workplace = getAttendanceWorkplace();
  const jitter = (Math.random() - 0.5) * 0.002;
  await updateEmployeeLastLocation(userId, {
    latitude: workplace.latitude + jitter,
    longitude: workplace.longitude + jitter,
    updatedAt: new Date().toISOString(),
    accuracy: 25,
  });
}

export function useEmployeeLocationPublisher(userId: string | undefined, enabled: boolean) {
  const lastPublishedAtRef = useRef(0);
  const lastCoordsRef = useRef<{latitude: number; longitude: number} | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    let cancelled = false;

    const clearIntervalId = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    const shouldPublish = (latitude: number, longitude: number, force = false) => {
      const now = Date.now();
      const lastCoords = lastCoordsRef.current;
      const movedEnough =
        !lastCoords ||
        getDistanceMeters(lastCoords.latitude, lastCoords.longitude, latitude, longitude) >=
          MIN_DISTANCE_METERS;
      const waitedEnough = now - lastPublishedAtRef.current >= MIN_PUBLISH_INTERVAL_MS;

      return force || movedEnough || waitedEnough;
    };

    const publishPosition = async (position: Location.LocationObject, force = false) => {
      const {latitude, longitude} = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      if (!shouldPublish(latitude, longitude, force)) {
        return;
      }

      lastPublishedAtRef.current = Date.now();
      lastCoordsRef.current = {latitude, longitude};
      await updateEmployeeLastLocation(userId, buildLocationPayload(position));
    };

    const pollAndPublish = async (force = false) => {
      if (cancelled) {
        return;
      }

      try {
        if (isMockMode) {
          await publishMockLocation(userId);
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          return;
        }

        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }

        const position = await readCurrentPositionSafe();
        if (!position || cancelled) {
          return;
        }

        await publishPosition(position, force);
      } catch {
        // Ignore teardown races during logout.
      }
    };

    const startPolling = () => {
      clearIntervalId();
      void pollAndPublish(true);
      intervalIdRef.current = setInterval(() => {
        void pollAndPublish(false);
      }, MIN_PUBLISH_INTERVAL_MS);
    };

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        startPolling();
        return;
      }

      clearIntervalId();
    };

    startPolling();
    const appStateSubscription = AppState.addEventListener('change', handleAppState);

    return () => {
      cancelled = true;
      clearIntervalId();
      appStateSubscription.remove();
    };
  }, [enabled, userId]);
}
