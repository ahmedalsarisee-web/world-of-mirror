export const PRIMARY_ADMIN_EMAIL = 'alsarisee3@gmail.com';

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return normalizeAdminEmail(email) === normalizeAdminEmail(PRIMARY_ADMIN_EMAIL);
}
