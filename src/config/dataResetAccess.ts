/** Optional dedicated password for "clear all business data". Falls back to Firebase re-auth when unset. */
export function getDedicatedDataResetPassword(): string {
  return (process.env.EXPO_PUBLIC_DATA_RESET_PASSWORD ?? '').trim();
}

export function hasDedicatedDataResetPassword(): boolean {
  return getDedicatedDataResetPassword().length > 0;
}
