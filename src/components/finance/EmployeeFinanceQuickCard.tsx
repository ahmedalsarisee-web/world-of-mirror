import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {ComponentProps} from 'react';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  label: string;
  amount: number;
  currencyLabel: string;
  amountTone?: 'positive' | 'negative';
  actionLabel: string;
  actionBackground: string;
  actionTextColor: string;
  onPress: () => void;
  onRename?: () => void;
}

const EmployeeFinanceQuickCard: React.FC<Props> = ({
  icon,
  iconColor,
  iconBackground,
  label,
  amount,
  currencyLabel,
  amountTone,
  actionLabel,
  actionBackground,
  actionTextColor,
  onPress,
  onRename,
}) => {
  const {theme} = useTheme();
  const {textStyle, centeredTextStyle, row, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        iconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        textWrap: {flex: 1, minWidth: 0},
        label: {
          fontSize: theme.typographyScale.size.xs,
          marginBottom: 1,
        },
        actionBtn: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          flexShrink: 0,
        },
        actionText: {fontSize: theme.typographyScale.size.xs, fontWeight: '600'},
        renameBtn: {
          padding: theme.spacing.xs,
          flexShrink: 0,
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.card, listCard, layoutStyle]}>
      <View style={[styles.iconWrap, {backgroundColor: iconBackground}]}>
        <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text
          style={[styles.label, textStyle, {color: theme.typography.secondary}]}
          numberOfLines={2}
        >
          {label}
        </Text>
        <AmountText amount={amount} size="sm" tone={amountTone} currencyLabel={currencyLabel} />
      </View>
      {onRename ? (
        <Pressable onPress={onRename} hitSlop={8} style={styles.renameBtn}>
          <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.typography.secondary} />
        </Pressable>
      ) : null}
      <Pressable
        style={[
          styles.actionBtn,
          {
            backgroundColor: actionBackground,
            borderRadius: theme.components.button.radius,
          },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.actionText, centeredTextStyle, {color: actionTextColor}]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
};

export default EmployeeFinanceQuickCard;
