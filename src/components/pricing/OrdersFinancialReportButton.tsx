import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const OrdersFinancialReportButton: React.FC<Props> = ({
  onPress,
  loading = false,
  disabled = false,
  style,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, inlineTextStyle, appFont} = useDirection();
  const isLight = theme.colors.background === '#F8FAFC';
  const accent = isLight ? '#1A3352' : '#5B7FA6';
  const background = isLight ? '#EFF6FF' : '#0F1A2E';
  const border = isLight ? '#1A3352' : '#5B7FA6';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          flexDirection: row,
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 8,
          borderWidth: 1.5,
          maxWidth: 108,
        },
        label: {
          fontSize: 10,
          fontWeight: '800',
          lineHeight: 13,
        },
      }),
    [row],
  );

  return (
    <Pressable
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: pressed || disabled ? 0.72 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={t('ordersFinancialReportExport')}
    >
      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <MaterialCommunityIcons name="file-document-outline" size={14} color={accent} />
      )}
      <Text
        style={[styles.label, textStyle, inlineTextStyle, appFont('bold'), {color: accent}]}
        numberOfLines={2}
      >
        {t('ordersFinancialReportButtonLabel')}
      </Text>
    </Pressable>
  );
};

export default OrdersFinancialReportButton;
