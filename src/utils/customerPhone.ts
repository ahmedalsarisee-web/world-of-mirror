import {Alert, Clipboard, Linking, Platform} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import type {TFunction} from 'i18next';
import {toWesternDigits} from '@app/utils/numericInput';

const WHATSAPP_MAIN_PACKAGE = 'com.whatsapp';

export const CUSTOMER_PHONE_LENGTH = 10;

const PHONE_SEGMENT_SEPARATOR_PATTERN = /[,;/\n\u060C]+/;
const BIDI_CONTROL_CHAR_PATTERN = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Keeps digits and common separators; strips bidi marks and normalizes country codes on paste. */
export function sanitizeCustomerPhoneInput(text: string): string {
  const western = toWesternDigits(text);
  const withoutBidi = western.replace(BIDI_CONTROL_CHAR_PATTERN, '');
  const cleaned = withoutBidi.replace(/[^\d,;/\n\u060C\s+]/g, '');

  if (!cleaned.trim()) {
    return '';
  }

  if (!PHONE_SEGMENT_SEPARATOR_PATTERN.test(cleaned)) {
    const digits = extractPhoneDigits(cleaned);
    if (!digits) {
      return '';
    }
    return normalizeCustomerPhoneSegmentDigits(digits);
  }

  const trailingSeparator = /[,;/\n\u060C]\s*$/.test(cleaned);
  const segments = cleaned.split(PHONE_SEGMENT_SEPARATOR_PATTERN);
  const normalizedSegments = segments
    .map((segment) => {
      const digits = extractPhoneDigits(segment);
      return digits ? normalizeCustomerPhoneSegmentDigits(digits) : '';
    })
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    return '';
  }

  let result = normalizedSegments.join(', ');
  if (trailingSeparator && normalizedSegments[normalizedSegments.length - 1]?.length === CUSTOMER_PHONE_LENGTH) {
    result += ', ';
  }

  return result;
}

/** @deprecated Use sanitizeCustomerPhoneInput — kept for existing imports. */
export function normalizeCustomerPhoneInput(text: string): string {
  return sanitizeCustomerPhoneInput(text);
}

function extractPhoneDigits(value: string): string {
  return toWesternDigits(value).replace(/[\s+]/g, '').replace(/\D/g, '');
}

/** Converts pasted international Jordan numbers to local 10-digit form when possible. */
export function normalizeCustomerPhoneSegmentDigits(digits: string): string {
  let value = digits;

  if (value.startsWith('00962') && value.length >= 14) {
    value = value.slice(5);
  } else if (value.startsWith('962') && value.length >= 12) {
    value = value.slice(3);
  }

  if (value.length === 9 && value.startsWith('7')) {
    value = `0${value}`;
  }

  return value;
}

/** Splits phone text into segments separated explicitly by comma, slash, etc. */
export function parseCustomerPhoneNumbers(phone: string): string[] {
  const cleaned = sanitizeCustomerPhoneInput(phone.trim());
  if (!cleaned) {
    return [];
  }

  if (!PHONE_SEGMENT_SEPARATOR_PATTERN.test(cleaned)) {
    const digits = extractPhoneDigits(cleaned);
    return digits ? [normalizeCustomerPhoneSegmentDigits(digits)] : [];
  }

  return cleaned
    .split(PHONE_SEGMENT_SEPARATOR_PATTERN)
    .map((segment) => normalizeCustomerPhoneSegmentDigits(extractPhoneDigits(segment)))
    .filter(Boolean);
}

export function getCustomerPhoneDigits(phone: string): string {
  return toWesternDigits(phone).replace(/\D/g, '');
}

export function isValidCustomerPhone(phone: string): boolean {
  const numbers = parseCustomerPhoneNumbers(phone);
  if (numbers.length === 0) {
    return false;
  }
  return numbers.every((entry) => entry.length === CUSTOMER_PHONE_LENGTH);
}

/** Used when confirming/saving — not while the user is still typing. */
export function getCustomerPhoneErrorKey(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  const numbers = parseCustomerPhoneNumbers(trimmed);
  if (numbers.length === 0) {
    return 'mirrorCartCustomerPhoneInvalid';
  }

  if (numbers.some((entry) => entry.length !== CUSTOMER_PHONE_LENGTH)) {
    return 'mirrorCartCustomerPhoneInvalid';
  }

  return null;
}

/** Optional single mobile — empty is valid; one 10-digit number when filled. */
export function sanitizeSingleCustomerPhoneInput(text: string): string {
  const withoutBidi = toWesternDigits(text).replace(BIDI_CONTROL_CHAR_PATTERN, '');
  const digits = normalizeCustomerPhoneSegmentDigits(extractPhoneDigits(withoutBidi));
  return digits.slice(0, CUSTOMER_PHONE_LENGTH);
}

export function formatSingleCustomerPhoneForStorage(phone: string): string {
  const digits = sanitizeSingleCustomerPhoneInput(phone);
  return digits.length === CUSTOMER_PHONE_LENGTH ? digits : '';
}

export function getOptionalSingleCustomerPhoneErrorKey(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  const digits = sanitizeSingleCustomerPhoneInput(trimmed);
  if (digits.length !== CUSTOMER_PHONE_LENGTH) {
    return 'mirrorCartCustomerPhone2Invalid';
  }

  return null;
}

/** Normalizes a validated phone value before persisting. */
export function formatCustomerPhoneForStorage(phone: string): string {
  return parseCustomerPhoneNumbers(phone).join(', ');
}

export function getCustomerPhoneInternationalDigits(phone: string): string {
  const digits = getCustomerPhoneDigits(phone);
  if (!digits) {
    return '';
  }
  if (digits.startsWith('962')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `962${digits.slice(1)}`;
  }
  return `962${digits}`;
}

export function getCustomerPhoneDialUri(phone: string): string {
  return `tel:${getCustomerPhoneDigits(phone)}`;
}

export function getCustomerPhoneWhatsAppUri(phone: string): string {
  const international = getCustomerPhoneInternationalDigits(phone);
  return international ? `https://wa.me/${international}` : '';
}

const ANDROID_VIEW_ACTION = 'android.intent.action.VIEW';

async function openMainWhatsAppViaIntentLauncher(international: string): Promise<boolean> {
  const targets = [
    `https://api.whatsapp.com/send?phone=${international}`,
    `whatsapp://send?phone=${international}`,
    `whatsapp://send?phone=+${international}`,
  ];

  for (const data of targets) {
    try {
      await IntentLauncher.startActivityAsync(ANDROID_VIEW_ACTION, {
        data,
        packageName: WHATSAPP_MAIN_PACKAGE,
      });
      return true;
    } catch (error) {
      console.warn('[customerPhone] IntentLauncher open failed', {data, error});
    }
  }

  return false;
}

async function openMainWhatsAppViaAndroidIntent(international: string): Promise<boolean> {
  if (await openMainWhatsAppViaIntentLauncher(international)) {
    return true;
  }

  const intentUrls = [
    `intent://send?phone=${international}#Intent;scheme=whatsapp;package=${WHATSAPP_MAIN_PACKAGE};end`,
    `intent://api.whatsapp.com/send?phone=${international}#Intent;scheme=https;package=${WHATSAPP_MAIN_PACKAGE};end`,
  ];

  for (const intentUrl of intentUrls) {
    try {
      await Linking.openURL(intentUrl);
      return true;
    } catch (error) {
      console.warn('[customerPhone] intent URL open failed', {intentUrl, error});
    }
  }

  const directUrls = [
    `whatsapp://send?phone=${international}`,
    `whatsapp://send?phone=+${international}`,
  ];

  for (const url of directUrls) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        continue;
      }
      await Linking.openURL(url);
      return true;
    } catch (error) {
      console.warn('[customerPhone] whatsapp scheme open failed', {url, error});
    }
  }

  return false;
}

export async function openCustomerWhatsAppChat(phone: string, t: TFunction): Promise<void> {
  const international = getCustomerPhoneInternationalDigits(phone);
  if (!international) {
    Alert.alert(t('error'), t('linkOpenFailed'));
    return;
  }

  if (Platform.OS === 'android') {
    if (await openMainWhatsAppViaAndroidIntent(international)) {
      return;
    }
    Alert.alert(t('error'), t('linkOpenFailed'));
    return;
  }

  try {
    const iosUrl = `whatsapp://send?phone=${international}`;
    const canOpen = await Linking.canOpenURL(iosUrl);
    if (canOpen) {
      await Linking.openURL(iosUrl);
      return;
    }
  } catch {
    // fall through
  }

  await openCustomerPhoneUri(getCustomerPhoneWhatsAppUri(phone), t);
}

export async function openCustomerPhoneCall(phone: string, t: TFunction): Promise<void> {
  await openCustomerPhoneUri(getCustomerPhoneDialUri(phone), t);
}

async function openCustomerPhoneUri(uri: string, t: TFunction): Promise<void> {
  if (!uri) {
    Alert.alert(t('error'), t('linkOpenFailed'));
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(uri);
    if (!canOpen) {
      Alert.alert(t('error'), t('linkOpenFailed'));
      return;
    }
    await Linking.openURL(uri);
  } catch {
    Alert.alert(t('error'), t('linkOpenFailed'));
  }
}

export function copyCustomerPhoneNumber(phone: string, t: TFunction): void {
  Clipboard.setString(phone);
  Alert.alert(t('done'), t('mirrorOrdersPhoneCopied'));
}

function promptSingleCustomerPhoneAction(phone: string, t: TFunction): void {
  Alert.alert(t('mirrorOrdersPhoneActionTitle'), phone, [
    {text: t('cancel'), style: 'cancel'},
    {
      text: t('mirrorOrdersPhoneCall'),
      onPress: () => {
        void openCustomerPhoneCall(phone, t);
      },
    },
    {
      text: t('mirrorOrdersPhoneWhatsApp'),
      onPress: () => {
        void openCustomerWhatsAppChat(phone, t);
      },
    },
  ]);
}

export function promptCustomerPhoneAction(phone: string, t: TFunction): void {
  const numbers = parseCustomerPhoneNumbers(phone);
  if (numbers.length === 0) {
    return;
  }

  if (numbers.length === 1) {
    promptSingleCustomerPhoneAction(numbers[0], t);
    return;
  }

  Alert.alert(t('mirrorOrdersPhonePickNumber'), phone, [
    ...numbers.map((entry) => ({
      text: entry,
      onPress: () => promptSingleCustomerPhoneAction(entry, t),
    })),
    {text: t('cancel'), style: 'cancel'},
  ]);
}
