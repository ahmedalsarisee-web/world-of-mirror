import React, {useMemo} from 'react';
import {Platform, StyleSheet, TextInput, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
}

const FinanceSearchBar: React.FC<Props> = ({value, onChangeText}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {row, textAlign, writingDirection, layoutStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: row,
          alignItems: 'center',
          marginHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          backgroundColor: theme.colors.inputBackground,
          borderRadius: theme.components.input.radius,
          minHeight: theme.components.input.height,
        },
        input: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          paddingVertical: Platform.OS === 'android' ? 8 : 10,
          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.wrap, layoutStyle]}>
      <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('searchTransactions')}
        placeholderTextColor={theme.colors.placeholder}
        style={[styles.input, {color: theme.typography.primary, textAlign, writingDirection}]}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
};

export default FinanceSearchBar;
