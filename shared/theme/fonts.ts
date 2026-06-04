import type {TextStyle} from 'react-native';
import type {LangCode} from '@app/types/language';

export const FONT_FAMILY = {
  en: 'Akt',
  ar: 'Cairo',
} as const satisfies Record<LangCode, string>;

export type FontWeightKey = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export const FONT_WEIGHT: Record<FontWeightKey, TextStyle['fontWeight']> = {
  regular: '500',
  medium: '600',
  semibold: '700',
  bold: '800',
  extrabold: '900',
};

export function getFontFamily(language: LangCode): string {
  return FONT_FAMILY[language];
}

export function appFont(language: LangCode, weight: FontWeightKey = 'medium'): TextStyle {
  return {
    fontFamily: getFontFamily(language),
    fontWeight: FONT_WEIGHT[weight],
  };
}

export function mergeAppFont(
  language: LangCode,
  style: TextStyle,
  weight: FontWeightKey = 'medium',
): TextStyle {
  return {...style, ...appFont(language, weight)};
}
