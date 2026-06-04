import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from 'firebase/auth';
import {deleteApp, initializeApp} from 'firebase/app';
import {httpsCallable} from '@firebase/functions';
import {getDedicatedDataResetPassword, hasDedicatedDataResetPassword} from '@app/config/dataResetAccess';
import {isMockMode} from '@app/config/appMode';
import {firebaseConfig, getFirebaseAuth, getFirebaseFunctions} from '@app/config/firebase';
import {getUserById, syncPrimaryAdminProfile} from '@app/services/users.service';
import type {AppUser} from '@app/types/models';

export type DataResetPasswordErrorCode = 'WRONG_PASSWORD' | 'NOT_CONFIGURED' | 'NOT_SIGNED_IN';

export class DataResetPasswordError extends Error {
  readonly code: DataResetPasswordErrorCode;

  constructor(code: DataResetPasswordErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  await syncPrimaryAdminProfile(credential.user.uid, credential.user.email ?? email);
  const profile = await getUserById(credential.user.uid);
  if (!profile) {
    throw new Error('User profile not found in database.');
  }
  return profile;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function loadUserProfile(uid: string): Promise<AppUser | null> {
  return getUserById(uid);
}

export async function registerAuthUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
  try {
    const credential = await createUserWithEmailAndPassword(getAuth(secondaryApp), email, password);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function deleteAuthAccount(userId: string): Promise<void> {
  const deleteAuthUser = httpsCallable<{userId: string}, {success: boolean}>(
    getFirebaseFunctions(),
    'deleteAuthUser',
  );
  await deleteAuthUser({userId});
}

export async function verifyDataResetPassword(password: string): Promise<void> {
  const trimmed = password.trim();
  if (!trimmed) {
    throw new DataResetPasswordError('WRONG_PASSWORD');
  }

  if (hasDedicatedDataResetPassword()) {
    if (trimmed !== getDedicatedDataResetPassword()) {
      throw new DataResetPasswordError('WRONG_PASSWORD');
    }
    return;
  }

  if (isMockMode) {
    throw new DataResetPasswordError('NOT_CONFIGURED');
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const email = user?.email?.trim();
  if (!user || !email) {
    throw new DataResetPasswordError('NOT_SIGNED_IN');
  }

  const credential = EmailAuthProvider.credential(email, trimmed);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch {
    throw new DataResetPasswordError('WRONG_PASSWORD');
  }
}

export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const email = user?.email?.trim();

  if (!user || !email) {
    throw new Error('Not signed in.');
  }

  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as {code: string}).code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Current password is incorrect.';
    case 'auth/requires-recent-login':
      return 'Please sign in again and retry changing your password.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Console.';
    default:
      return error instanceof Error ? error.message : 'Failed to create user.';
  }
}

export function getDeleteUserErrorKey(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as {code: string}).code) : '';

  switch (code) {
    case 'functions/permission-denied':
      return 'deleteUserNotAllowed';
    case 'functions/unauthenticated':
      return 'deleteUserSignInRequired';
    case 'functions/not-found':
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'deleteUserServiceUnavailable';
    default:
      return 'deleteUserFailed';
  }
}
