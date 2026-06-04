import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AttendanceResetSchedulePanel from '@app/components/attendance/AttendanceResetSchedulePanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {formatDate} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeAttendanceReset'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeAttendanceReset'>;

const EmployeeAttendanceResetScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const {data: employee, isLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(route.params.userId, callback),
    [route.params.userId],
    {enabled: isAdmin},
  );
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
        },
        infoCard: {
          padding: theme.spacing.md,
          marginTop: theme.spacing.sm,
          gap: theme.spacing.xs,
        },
        infoLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        infoValue: {
          fontSize: theme.typographyScale.size.sm,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  if (!isAdmin) {
    return null;
  }

  return (
    <ScreenContainer>
      <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
        {t('attendanceResetScheduleDetailHint', {name: route.params.userName})}
      </Text>

      {isLoading ? (
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      ) : (
        <>
          <AttendanceResetSchedulePanel
            userId={route.params.userId}
            schedule={employee?.attendanceResetSchedule}
          />

          {employee?.attendanceLastResetBoundary ? (
            <View style={[listCard, styles.infoCard, layoutStyle]}>
              <Text style={[styles.infoLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('attendanceResetLastProcessed')}
              </Text>
              <Text style={[styles.infoValue, textStyle, {color: theme.typography.primary}]}>
                {formatDate(employee.attendanceLastResetBoundary)}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
};

export default EmployeeAttendanceResetScreen;
