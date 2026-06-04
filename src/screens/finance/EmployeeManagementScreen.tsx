import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import IconLabelButton from '@app/components/common/IconLabelButton';
import ListLoadingState from '@app/components/common/ListLoadingState';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToAllAttendance} from '@app/services/attendance.service';
import {getEmployees, getAdmins, subscribeToUsers} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {canAccessEmployeeManagement, canManageAdmins} from '@app/utils/adminPermissions';
import {formatPermissionSummary, resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeManagementHome'>;

const EmployeeManagementScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, chevronForward, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const isAdmin = currentUser?.role === 'admin';
  const canManageAdminAccounts = canManageAdmins(currentUser, authEmail);
  const hasEmployeeManagementAccess = canAccessEmployeeManagement(currentUser);
  const {data: users, isLoading} = useFirestoreSubscription<AppUser[]>([], subscribeToUsers);
  const {data: attendanceRecords} = useFirestoreSubscription<AttendanceRecord[]>(
    [],
    subscribeToAllAttendance,
    [],
    {enabled: isAdmin},
  );
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const employees = useMemo(() => getEmployees(users), [users]);
  const admins = useMemo(
    () => getAdmins(users).filter((admin) => admin.id !== currentUser?.id),
    [currentUser?.id, users],
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
        header: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        },
        title: {flex: 1, fontSize: 20, fontWeight: '700'},
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: 16,
          marginBottom: 10,
          gap: 10,
        },
        textWrap: {flex: 1, minWidth: 0, alignSelf: 'center'},
        name: {fontSize: 16, fontWeight: '600', marginBottom: 4},
        summary: {fontSize: 13, lineHeight: 18},
        trailing: {flexDirection: row, alignItems: 'center', gap: 8, flexShrink: 0},
        presence: {fontSize: 13, fontWeight: '700', flexShrink: 0},
        sectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          marginBottom: 10,
          marginTop: 8,
        },
        adminBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          flexShrink: 0,
        },
        adminBadgeText: {fontSize: 11, fontWeight: '700'},
        empty: {fontSize: 15, lineHeight: 22},
      }),
    [row],
  );

  if (!isAdmin || !hasEmployeeManagementAccess) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.status.error}]}>{t('accessDenied')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.header, layoutStyle]}>
        <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{t('manageEmployees')}</Text>
        <IconLabelButton
          label={t('addUser')}
          icon="account-plus"
          onPress={() => navigation.navigate('UserForm')}
        />
      </View>

      {isLoading ? (
        <ListLoadingState />
      ) : (
        <>
          {canManageAdminAccounts ? (
            <>
              <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
                {t('manageAdmins')}
              </Text>
              {admins.length === 0 ? (
                <Text style={[styles.empty, textStyle, {color: theme.typography.secondary, marginBottom: 16}]}>
                  {t('noOtherAdmins')}
                </Text>
              ) : (
                admins.map((admin) => (
                  <Pressable
                    key={admin.id}
                    style={[styles.card, listCard]}
                    onPress={() =>
                      navigation.navigate('AdminDetail', {
                        userId: admin.id,
                        userName: admin.name,
                      })
                    }
                  >
                    <View style={styles.textWrap}>
                      <Text
                        numberOfLines={1}
                        style={[styles.name, inlineTextStyle, {color: theme.typography.primary}]}
                      >
                        {admin.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.summary, inlineTextStyle, {color: theme.typography.secondary}]}
                      >
                        {admin.email ?? t('adminRole')}
                      </Text>
                    </View>
                    <View style={styles.trailing}>
                      {admin.isPrimaryAdmin ? (
                        <View style={[styles.adminBadge, {backgroundColor: `${theme.colors.primary}18`}]}>
                          <Text style={[styles.adminBadgeText, inlineTextStyle, {color: theme.colors.primary}]}>
                            {t('primaryAdminRole')}
                          </Text>
                        </View>
                      ) : null}
                      <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
                    </View>
                  </Pressable>
                ))
              )}
            </>
          ) : null}

          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('employeesSection')}
          </Text>
          {employees.length === 0 ? (
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
                    navigation.navigate('EmployeeDetail', {
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
                    <Text
                      numberOfLines={1}
                      style={[styles.summary, inlineTextStyle, {color: theme.typography.secondary}]}
                    >
                      {formatPermissionSummary(resolveEmployeePermissions(employee), t)}
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
        </>
      )}
    </ScreenContainer>
  );
};

export default EmployeeManagementScreen;
