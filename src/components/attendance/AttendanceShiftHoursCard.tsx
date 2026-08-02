import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatAttendanceShiftHoursSummary} from '@app/utils/attendanceShiftHours';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  shiftHours?: number;
  onPress?: () => void;
}

const AttendanceShiftHoursCard: React.FC<Props> = ({shiftHours, onPress}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, chevronForward, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary + '18',
        },
        textWrap: {flex: 1, minWidth: 0},
        title: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          marginBottom: 2,
        },
        subtitle: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
      }),
    [row, theme],
  );

  const content = (
    <>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, inlineTextStyle, {color: theme.typography.primary}]}>
          {t('attendanceShiftHoursTitle')}
        </Text>
        <Text style={[styles.subtitle, inlineTextStyle, {color: theme.typography.secondary}]} numberOfLines={2}>
          {formatAttendanceShiftHoursSummary(shiftHours, t)}
        </Text>
      </View>
      {onPress ? <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[listCard, styles.card, layoutStyle]}>{content}</View>;
  }

  return (
    <Pressable
      style={({pressed}) => [listCard, styles.card, layoutStyle, {opacity: pressed ? 0.75 : 1}]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
};

export default AttendanceShiftHoursCard;
