import {Platform} from 'react-native';
import * as Location from 'expo-location';

/** Android release builds often crash with concurrent native location watchers. */
export const USE_LOCATION_POLLING_ONLY = Platform.OS === 'android';

let locationChain: Promise<unknown> = Promise.resolve();

/**
 * Serialize native location calls (check-in + background tracking) to avoid races.
 */
export function runExclusiveLocationTask<T>(task: () => Promise<T>): Promise<T> {
  const run = locationChain.then(task, task);
  locationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readCurrentPositionSafe(
  accuracy: Location.Accuracy = Location.Accuracy.Balanced,
  timeoutMs = 10_000,
): Promise<Location.LocationObject | null> {
  return runExclusiveLocationTask(async () => {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({maxAge: 120_000});
      if (lastKnown) {
        return lastKnown;
      }
    } catch {
      // Continue to live read.
    }

    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy,
          mayShowUserSettingsDialog: Platform.OS === 'ios',
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('position_timeout')), timeoutMs);
        }),
      ]);
    } catch {
      return null;
    }
  });
}
