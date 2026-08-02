import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_COMPLETE_KEY = 'confirmed-orders-index-migration-v1';

export async function isConfirmedOrdersIndexMigrationComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_COMPLETE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markConfirmedOrdersIndexMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
  } catch {
    // ignore persistence failures
  }
}
