import React from 'react';
import {Platform, Text} from 'react-native';
import {useLanguage} from '@app/context/LangContext';
import {appFont} from '@shared/theme/fonts';

interface Props {
  children: string;
  color: string;
}

const HeaderTitle: React.FC<Props> = ({children, color}) => {
  const {language} = useLanguage();

  return (
    <Text
      allowFontScaling={false}
      style={[
        appFont(language, 'bold'),
        {
          color,
          fontSize: 17,
          textAlign: 'center',
          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
        },
      ]}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
};

export default HeaderTitle;
