import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  leading: React.ReactNode;
  leadingBackground?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  badges?: React.ReactNode;
  amount: number;
  currencyLabel: string;
  viewOnly?: boolean;
  viewOnlyLabel?: string;
  onPress: () => void;
  showDivider?: boolean;
  trailingAction?: React.ReactNode;
}

const FinanceListRow: React.FC<Props> = ({
  leading,
  leadingBackground,
  title,
  titleColor,
  subtitle,
  badges,
  amount,
  currencyLabel,
  viewOnly,
  viewOnlyLabel,
  onPress,
  showDivider = false,
  trailingAction,
}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, inlineTextStyle, alignEnd, isRTL} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.divider,
          marginStart: 52,
        },
        rowInner: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.sm,
        },
        leading: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        body: {flex: 1, minWidth: 0},
        titleRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        },
        title: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          flexShrink: 1,
        },
        subtitle: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
        amountCol: {
          alignItems: alignEnd,
          flexShrink: 0,
          maxWidth: 120,
        },
        viewOnlyText: {
          fontSize: 10,
          marginTop: 1,
        },
        chevron: {
          marginStart: 2,
          flexShrink: 0,
        },
      }),
    [alignEnd, row, theme],
  );

  return (
    <>
      {showDivider ? <View style={styles.divider} /> : null}
      <Pressable
        style={({pressed}) => [styles.rowInner, layoutStyle, pressed && {opacity: 0.72}]}
        onPress={onPress}
      >
        <View style={[styles.leading, leadingBackground ? {backgroundColor: leadingBackground} : null]}>
          {leading}
        </View>
        <View style={styles.body}>
          <View style={[styles.titleRow, layoutStyle]}>
            <Text
              style={[styles.title, textStyle, {color: titleColor ?? theme.typography.primary}]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {badges}
          </View>
          {subtitle ? (
            <Text
              style={[styles.subtitle, inlineTextStyle, {color: theme.typography.secondary}]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.amountCol}>
          <AmountText amount={amount} size="sm" currencyLabel={currencyLabel} />
          {viewOnly && viewOnlyLabel ? (
            <Text style={[styles.viewOnlyText, textStyle, {color: theme.typography.secondary}]}>
              {viewOnlyLabel}
            </Text>
          ) : null}
        </View>
        {trailingAction ?? (
          <MaterialCommunityIcons
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={theme.colors.icon}
            style={styles.chevron}
          />
        )}
      </Pressable>
    </>
  );
};

export default FinanceListRow;
