import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, type TextStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {copyCustomerPhoneNumber, promptCustomerPhoneAction} from '@app/utils/customerPhone';

const LONG_PRESS_COPY_MS = 1000;

interface Props {
  phone: string;
  style?: TextStyle;
}

const CustomerPhoneLink: React.FC<Props> = ({phone, style}) => {
  const {t} = useTranslation();
  const {ltrTextStyle} = useDirection();
  const trimmed = phone.trim();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          alignSelf: 'flex-start',
        },
        link: {
          color: '#2563EB',
          textDecorationLine: 'underline',
          fontWeight: '600',
        },
      }),
    [],
  );

  if (!trimmed) {
    return null;
  }

  return (
    <Pressable
      style={({pressed}) => [styles.pressable, pressed ? {opacity: 0.72} : null]}
      onPress={() => promptCustomerPhoneAction(trimmed, t)}
      onLongPress={() => copyCustomerPhoneNumber(trimmed, t)}
      delayLongPress={LONG_PRESS_COPY_MS}
      accessibilityRole="link"
      accessibilityLabel={trimmed}
      accessibilityHint={t('mirrorOrdersPhoneCopy')}
    >
      <Text style={[style, styles.link, ltrTextStyle]}>{trimmed}</Text>
    </Pressable>
  );
};

export default CustomerPhoneLink;
