import React, {useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import DirectionalView from '@app/components/common/DirectionalView';
import ListLoadingState from '@app/components/common/ListLoadingState';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToAllAttendance} from '@app/services/attendance.service';
import {getEmployees} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import type {AttendanceStackParamList} from '@app/types/navigation';
import {
  canViewEmployeeAttendance,
  filterEmployeesForAttendanceViewer,
} from '@app/utils/employeePermissions';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<AttendanceStackParamList, 'TeamAttendanceList'>;

const TeamAttendanceListScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, chevronForward, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const canAccess = canViewEmployeeAttendance(currentUser);
  const {users, isLoading: usersLoading} = useUsersDirectory('all', canAccess);
  const {data: attendanceRecords} = useFirestoreSubscription<AttendanceRecord[]>(
    [],
    subscribeToAllAttendance,
    [],
    {enabled: canAccess},
  );
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const employees = useMemo(
    () => filterEmployeesForAttendanceViewer(currentUser, getEmployees(users)),
    [currentUser, users],
  );

  const attendanceByUser = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const record of attendanceRecords) {
      const userRecords = map.get(record.userId) ?? [];
      userRecords.push(record);
      map.set(record.userId, userRecords);
    }
    return map;
  }, [attendanceRecords]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.backgrounds.background},
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.md,
        },
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        textWrap: {flex: 1, minWidth: 0},
        name: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '600',
          marginBottom: 2,
        },
        trailing: {flexDirection: row, alignItems: 'center', gap: theme.spacing.xs, flexShrink: 0},
        presence: {fontSize: theme.typographyScale.size.sm, fontWeight: '700', flexShrink: 0},
        empty: {fontSize: theme.typographyScale.size.md, lineHeight: 22},
      }),
    [row, theme],
  );

  useEffect(() => {
    if (currentUser && !canAccess) {
      navigation.goBack();
    }
  }, [canAccess, currentUser, navigation]);

  if (!canAccess) {
    return null;
  }

  return (
    <DirectionalView style={styles.container}>
      <ScreenHeader title={t('teamAttendanceList')} />
      <ScreenContainer>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
          {t('teamAttendanceListHint')}
        </Text>

        {usersLoading ? (
          <ListLoadingState />
        ) : employees.length === 0 ? (
          <Text style={[styles.empty, textStyle, {color: theme.typography.secondary}]}>{t('noEmployees')}</Text>
        ) : (
          employees.map((employee) => {
            const employeeRecords = attendanceByUser.get(employee.id) ?? [];
            const isPresent = getEmployeePresenceStatus(employeeRecords) === 'present';

            return (
              <Pressable
                key={employee.id}
                style={[styles.card, listCard]}
                onPress={() =>
                  navigation.navigate('EmployeeAttendanceView', {
                    userId: employee.id,
                    userName: employee.name,
                  })
                }
              >
                <View style={styles.textWrap}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, inlineTextStyle, {color: theme.typography.primary}]}
                  >
                    {employee.name}
                  </Text>
                </View>
                <View style={styles.trailing}>
                  <Text
                    style={[
                      styles.presence,
                      inlineTextStyle,
                      {color: isPresent ? theme.colors.balancePositive : theme.colors.balanceNegative},
                    ]}
                  >
                    {isPresent ? t('employeePresent') : t('employeeAway')}
                  </Text>
                  <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScreenContainer>
    </DirectionalView>
  );
};

export default TeamAttendanceListScreen;
