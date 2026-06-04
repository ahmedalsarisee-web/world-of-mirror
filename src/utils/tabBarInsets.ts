import {Platform} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

/** Icon + label area (default RN tab bar is 49px — too tight for Arabic labels). */
export const TAB_BAR_CONTENT_HEIGHT = 58;

/** Samsung / Android 3-button nav when system insets report 0. */
const ANDROID_MIN_BOTTOM_INSET = 52;

export function getEffectiveTabBarInsets(insets: EdgeInsets): EdgeInsets {
  if (Platform.OS !== 'android') {
    return insets;
  }

  return {...insets, bottom: Math.max(insets.bottom, ANDROID_MIN_BOTTOM_INSET)};
}

export function getTabBarHeight(insets: EdgeInsets): number {
  return TAB_BAR_CONTENT_HEIGHT + getEffectiveTabBarInsets(insets).bottom;
}
