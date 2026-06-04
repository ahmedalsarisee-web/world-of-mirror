import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  balance: number;
  onPress: () => void;
}

const EmployeeHomeBalanceCard: React.FC<Props> = ({balance, onPress}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, centeredTextStyle, row, chevronForward, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.successLight,
        },
        textWrap: {flex: 1},
        label: {
          fontSize: theme.typographyScale.size.xs,
          marginBottom: 2,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
      }),
    [row, theme],
  );

  return (
    <Pressable
      style={({pressed}) => [listCard, styles.card, layoutStyle, {opacity: pressed ? 0.75 : 1}]}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="wallet-outline" size={20} color={theme.colors.success} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, textStyle, {color: theme.typography.secondary}]}>{t('currentBalance')}</Text>
        <AmountText amount={balance} size="md" currencyLabel={t('currencyLabel')} />
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('employeeHomeViewAccount')}
        </Text>
      </View>
      <MaterialCommunityIcons name={chevronForward} size={20} color={theme.colors.icon} />
    </Pressable>
  );
};

export default EmployeeHomeBalanceCard;
