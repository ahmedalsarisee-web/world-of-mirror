import React, {useMemo} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {sanitizeOrdersSearchInput} from '@app/utils/mirrorOrdersSearch';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  resultCount?: number;
  loading?: boolean;
}

const OrdersSearchBar: React.FC<Props> = ({value, onChangeText, resultCount, loading = false}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {row, textAlign, writingDirection, layoutStyle, inlineTextStyle} = useDirection();
  const hasQuery = value.trim().length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.xs},
        shell: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          minHeight: 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${theme.colors.primary}35`,
          backgroundColor: theme.colors.card,
          ...theme.shadow.card,
        },
        shellFocused: {
          borderColor: theme.colors.primary,
          backgroundColor: `${theme.colors.primary}08`,
        },
        input: {
          flex: 1,
          minWidth: 0,
          fontSize: theme.typographyScale.size.sm,
          paddingVertical: Platform.OS === 'android' ? 10 : 12,
          ...(Platform.OS === 'android' ? {includeFontPadding: false, textAlignVertical: 'center'} : null),
        },
        metaRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 18,
          paddingHorizontal: 4,
        },
        metaText: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        hintText: {fontSize: theme.typographyScale.size.xs, lineHeight: 18, opacity: 0.85},
      }),
    [row, theme],
  );

  const textInputProps: TextInputProps =
    Platform.OS === 'android'
      ? {importantForAutofill: 'no', underlineColorAndroid: 'transparent'}
      : {};

  return (
    <View style={[styles.root, layoutStyle]}>
      <View style={[styles.shell, hasQuery ? styles.shellFocused : null]}>
        <MaterialCommunityIcons
          name="text-search"
          size={22}
          color={hasQuery ? theme.colors.primary : theme.colors.icon}
        />
        <TextInput
          {...textInputProps}
          value={value}
          onChangeText={(text) => onChangeText(sanitizeOrdersSearchInput(text))}
          placeholder={t('ordersSearchPlaceholder')}
          placeholderTextColor={theme.colors.placeholder}
          style={[styles.input, {color: theme.typography.primary, textAlign, writingDirection}]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : hasQuery && Platform.OS === 'android' ? (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('ordersSearchClear')}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.icon} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.hintText, inlineTextStyle, {color: theme.typography.secondary}]}>
          {hasQuery && typeof resultCount === 'number'
            ? t('ordersSearchResultsCount', {count: resultCount})
            : t('ordersSearchHint')}
        </Text>
      </View>
    </View>
  );
};

export default React.memo(OrdersSearchBar);
