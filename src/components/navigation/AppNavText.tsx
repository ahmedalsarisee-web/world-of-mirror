import React from 'react';
import {Platform, Text, type TextStyle} from 'react-native';
import {useLanguage} from '@app/context/LangContext';
import {appFont} from '@shared/theme/fonts';

interface Props {
  children: string;
  color: string;
  style?: TextStyle;
  size?: number;
}

export const TabBarLabel: React.FC<Props> = ({children, color, style, size = 12}) => {
  const {language} = useLanguage();

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        appFont(language, 'semibold'),
        {
          color,
          fontSize: size,
          lineHeight: size + 3,
          textAlign: 'center',
          marginTop: 2,
          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const NavHeaderTitle: React.FC<Props> = ({children, color, style}) => {
  const {language} = useLanguage();

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      ellipsizeMode="tail"
      style={[
        appFont(language, 'bold'),
        {
          color,
          fontSize: 17,
          lineHeight: 22,
          textAlign: 'center',
          width: '100%',
          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const TopTabLabel: React.FC<Props> = ({children, color, style}) => {
  const {language} = useLanguage();

  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        appFont(language, 'semibold'),
        {
          color,
          fontSize: 14,
          textAlign: 'center',
          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export default TabBarLabel;
