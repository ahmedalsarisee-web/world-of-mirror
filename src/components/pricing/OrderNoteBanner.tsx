import React, {useMemo} from 'react';
import {StyleSheet, Text, View, type TextStyle} from 'react-native';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  note: string;
  inlineTextStyle?: TextStyle;
}

const OrderNoteBanner: React.FC<Props> = ({note, inlineTextStyle}) => {
  const {theme} = useTheme();
  const isLightTheme = theme.colors.background === '#F8FAFC';
  const trimmed = note.trim();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          marginTop: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          backgroundColor: isLightTheme ? '#FFF7ED' : '#2A1A10',
          borderColor: isLightTheme ? '#FED7AA' : '#5C3A1F',
        },
        text: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          lineHeight: 18,
          color: theme.status.warning,
        },
      }),
    [isLightTheme, theme],
  );

  if (!trimmed) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={[styles.text, inlineTextStyle]}>{trimmed}</Text>
    </View>
  );
};

export default OrderNoteBanner;
