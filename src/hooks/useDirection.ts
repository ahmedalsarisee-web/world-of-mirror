import {useMemo} from 'react';
import type {TextStyle} from 'react-native';
import {useLanguage} from '@app/context/LangContext';
import {LangDirection} from '@shared/enums/LangDirection';
import {appFont, mergeAppFont} from '@shared/theme/fonts';
import {
  getAlignItemsEnd,
  getAlignItemsStart,
  getCenteredTextStyle,
  getCompactLabelTextStyle,
  getChevronBack,
  getChevronForward,
  getFlexDirection,
  getInlineTextStyle,
  getLayoutDirection,
  getLayoutStyle,
  getTextAlign,
  getTextStyle,
  getWritingDirection,
  isRTL as checkRTL,
} from '@shared/utils/directionalStyles';

export function useDirection() {
  const {direction, language} = useLanguage();

  return useMemo(() => {
    const rtl = checkRTL(direction);
    const fontFamily = appFont(language).fontFamily!;

    const withFont = (style: TextStyle, weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'medium') =>
      mergeAppFont(language, style, weight);

    return {
      direction,
      language,
      isRTL: rtl,
      fontFamily,
      layoutDirection: getLayoutDirection(direction),
      row: getFlexDirection(direction),
      textAlign: getTextAlign(direction),
      writingDirection: getWritingDirection(direction),
      textStyle: withFont(getTextStyle(direction), 'medium'),
      inlineTextStyle: withFont(getInlineTextStyle(direction), 'medium'),
      centeredTextStyle: withFont(getCenteredTextStyle(direction), 'semibold'),
      compactLabelTextStyle: withFont(getCompactLabelTextStyle(direction), 'semibold'),
      titleTextStyle: withFont(getTextStyle(direction), 'bold'),
      layoutStyle: getLayoutStyle(direction),
      chevronForward: getChevronForward(direction),
      chevronBack: getChevronBack(direction),
      alignStart: getAlignItemsStart(direction),
      alignEnd: getAlignItemsEnd(direction),
      ltrTextStyle: withFont(
        {
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        'medium',
      ),
      appFont: (weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' = 'medium') =>
        appFont(language, weight),
    };
  }, [direction, language]);
}
