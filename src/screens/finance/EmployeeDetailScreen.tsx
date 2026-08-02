import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import DashboardShortcutGrid, {
  type DashboardShortcut,
} from '@app/components/dashboard/DashboardShortcutGrid';
import EmployeeManagementScreenLayout from '@app/components/employee-management/EmployeeManagementScreenLayout';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {formatPermissionSummary, resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {formatEmployeeLocationUpdatedAt} from '@app/utils/employeeLocationDisplay';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeDetail'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeDetail'>;

const EmployeeDetailScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [employee, setEmployee] = useState<AppUser | null>(null);
  const screenTitle = employee?.name ?? userName;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionHeader: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
          paddingHorizontal: 2,
        },
        sectionIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionTitle: {
          flex: 1,
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
        },
      }),
    [row, theme],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    return subscribeToUser(userId, setEmployee);
  }, [userId]);

  const shortcuts = useMemo<DashboardShortcut[]>(() => {
    if (!employee) {
      return [];
    }

    const permissionSummary = formatPermissionSummary(resolveEmployeePermissions(employee), t);

    return [
      {
        key: 'permissions',
        icon: 'shield-account-outline',
        iconColor: theme.colors.primary,
        iconBackground: `${theme.colors.primary}18`,
        accentColor: theme.colors.primary,
        label: t('employeePermissions'),
        description: permissionSummary,
        onPress: () => navigation.navigate('EmployeePermissions', {userId, userName: screenTitle}),
      },
      {
        key: 'location',
        icon: 'map-marker-radius-outline',
        iconColor: theme.colors.warning,
        iconBackground: theme.colors.dangerLight,
        accentColor: theme.colors.warning,
        label: t('employeeLocation'),
        description: formatEmployeeLocationUpdatedAt(employee.lastLocation, t),
        onPress: () => navigation.navigate('EmployeeLocation', {userId, userName: screenTitle}),
      },
      {
        key: 'attendance',
        icon: 'calendar-clock-outline',
        iconColor: theme.colors.success,
        iconBackground: theme.colors.successLight,
        accentColor: theme.colors.success,
        label: t('employeeAttendance'),
        description: t('employeeAttendanceHint'),
        onPress: () => navigation.navigate('EmployeeAttendance', {userId, userName: screenTitle}),
      },
    ];
  }, [employee, navigation, screenTitle, t, theme, userId]);

  if (!isAdmin) {
    return null;
  }

  if (!employee) {
    return (
      <EmployeeManagementScreenLayout title={screenTitle}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </EmployeeManagementScreenLayout>
    );
  }

  return (
    <EmployeeManagementScreenLayout title={screenTitle}>
      <View style={[styles.sectionHeader, layoutStyle]}>
        <View style={[styles.sectionIconWrap, {backgroundColor: `${theme.colors.primary}18`}]}>
          <MaterialCommunityIcons name="view-grid-outline" size={18} color={theme.colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
          {t('employeeDetailSections')}
        </Text>
      </View>

      <DashboardShortcutGrid shortcuts={shortcuts} />
    </EmployeeManagementScreenLayout>
  );
};

export default EmployeeDetailScreen;
