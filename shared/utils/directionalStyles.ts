import {I18nManager} from 'react-native';
import type {TextStyle, ViewStyle} from 'react-native';
import {LangDirection} from '@shared/enums/LangDirection';

export const isRTL = (d: LangDirection) => d === LangDirection.RTL;

/**
 * With I18nManager.forceRTL, left/right are mirrored at the native layer.
 * Use `left` for block text so it appears on the visual right in Arabic.
 */
export const getTextAlign = (d: LangDirection): TextStyle['textAlign'] => {
  if (I18nManager.isRTL) return 'left';
  return d === LangDirection.RTL ? 'right' : 'left';
};

export const getFlexDirection = (d: LangDirection): ViewStyle['flexDirection'] => {
  if (I18nManager.isRTL) return 'row';
  return d === LangDirection.RTL ? 'row-reverse' : 'row';
};

export const getLayoutDirection = (d: LangDirection): ViewStyle['direction'] | undefined => {
  const wantsRtl = d === LangDirection.RTL;
  if (I18nManager.isRTL === wantsRtl) {
    return wantsRtl ? 'rtl' : 'ltr';
  }
  return undefined;
};

export const getWritingDirection = (d: LangDirection): TextStyle['writingDirection'] =>
  d === LangDirection.RTL ? 'rtl' : 'ltr';

export const getAlignSelf = (d: LangDirection): ViewStyle['alignSelf'] =>
  d === LangDirection.RTL ? 'flex-end' : 'flex-start';

export const getAlignItemsStart = (d: LangDirection): ViewStyle['alignItems'] => {
  if (I18nManager.isRTL) return 'flex-start';
  return d === LangDirection.RTL ? 'flex-end' : 'flex-start';
};

export const getAlignItemsEnd = (d: LangDirection): ViewStyle['alignItems'] => {
  if (I18nManager.isRTL) return 'flex-end';
  return d === LangDirection.RTL ? 'flex-start' : 'flex-end';
};

export const getChevronForward = (d: LangDirection) =>
  d === LangDirection.RTL ? 'chevron-left' : 'chevron-right';

export const getChevronBack = (d: LangDirection) =>
  d === LangDirection.RTL ? 'chevron-right' : 'chevron-left';

/** Block text (titles, labels, list rows) — full width + correct visual alignment */
export const getTextStyle = (d: LangDirection): TextStyle => ({
  textAlign: getTextAlign(d),
  writingDirection: getWritingDirection(d),
  alignSelf: 'stretch',
  width: '100%',
});

/** Row / inline text — no full width (avoids clipping in flex rows) */
export const getInlineTextStyle = (d: LangDirection): TextStyle => ({
  textAlign: getTextAlign(d),
  writingDirection: getWritingDirection(d),
});

/** Full-width buttons & badges — text centered in the container */
export const getCenteredTextStyle = (d: LangDirection): TextStyle => ({
  textAlign: 'center',
  writingDirection: getWritingDirection(d),
  width: '100%',
});

/** Icon + label in a row — no full width so icon stays beside text */
export const getCompactLabelTextStyle = (d: LangDirection): TextStyle => ({
  textAlign: 'center',
  writingDirection: getWritingDirection(d),
  flexShrink: 1,
});

export const getLayoutStyle = (d: LangDirection): ViewStyle => {
  const direction = getLayoutDirection(d);
  return direction ? {direction} : {};
};

export const getMarginStart = (_d: LangDirection, v: number) => ({marginStart: v});

export const getMarginEnd = (_d: LangDirection, v: number) => ({marginEnd: v});

export const getMarginLeft = (d: LangDirection, v: number) => getMarginStart(d, v);

export const getMarginRight = (d: LangDirection, v: number) => getMarginEnd(d, v);

export const getPaddingStart = (_d: LangDirection, v: number) => ({paddingStart: v});

export const getPaddingEnd = (_d: LangDirection, v: number) => ({paddingEnd: v});

export const getPositionEnd = (d: LangDirection, value: number) => {
  if (I18nManager.isRTL) return {left: value};
  return d === LangDirection.RTL ? {left: value} : {right: value};
};

export const getPositionStart = (d: LangDirection, value: number) => {
  if (I18nManager.isRTL) return {right: value};
  return d === LangDirection.RTL ? {right: value} : {left: value};
};
