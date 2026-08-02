import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Switch, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import EmployeeManagementScreenLayout from '@app/components/employee-management/EmployeeManagementScreenLayout';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {deleteUser, subscribeToUser, updateEmployeePermissions} from '@app/services/users.service';
import {getDeleteUserErrorKey} from '@app/services/auth.service';
import {useAuthStore} from '@app/stores/authStore';
import type {EmployeePermissions, AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {canDeleteUser} from '@app/utils/adminPermissions';
import {getDefaultEmployeePermissions, resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeePermissions'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeePermissions'>;

const PERMISSION_OPTIONS: {
  field: keyof EmployeePermissions;
  labelKey: string;
  icon: string;
}[] = [
  {field: 'finance', labelKey: 'permissionFinance', icon: 'cash-multiple'},
  {field: 'editFinanceTransactions', labelKey: 'permissionEditFinanceTransactions', icon: 'pencil-outline'},
  {field: 'employeeFinance', labelKey: 'permissionEmployeeFinance', icon: 'account-cash'},
  {field: 'employeeAttendance', labelKey: 'permissionEmployeeAttendance', icon: 'account-group'},
  {field: 'attendanceLocationRequired', labelKey: 'permissionAttendanceLocation', icon: 'map-marker-radius'},
  {field: 'attendanceGpsLinked', labelKey: 'permissionAttendanceGpsLinked', icon: 'crosshairs-gps'},
  {field: 'moveOrders', labelKey: 'permissionMoveOrders', icon: 'swap-horizontal'},
  {field: 'deleteOrders', labelKey: 'permissionDeleteOrders', icon: 'trash-can-outline'},
  {field: 'orderCardNotes', labelKey: 'permissionOrderCardNotes', icon: 'note-text-outline'},
  {field: 'showNotificationsIcon', labelKey: 'permissionShowNotificationsIcon', icon: 'bell-outline'},
];

const EmployeePermissionsScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const isAdmin = currentUser?.role === 'admin';
  const [permissions, setPermissions] = useState<EmployeePermissions>(getDefaultEmployeePermissions());
  const [loading, setLoading] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const screenTitle = targetUser?.name ?? userName;
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        subtitle: {fontSize: 14, marginBottom: 20, lineHeight: 20},
        sectionTitle: {fontSize: 16, fontWeight: '600', marginBottom: 12},
        row: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 10,
          gap: 12,
        },
        rowText: {flex: 1, flexDirection: row, alignItems: 'center', gap: 12},
        rowLabel: {fontSize: 15, fontWeight: '600'},
        deleteBtn: {marginTop: 24},
      }),
    [row],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    const unsub = subscribeToUser(userId, (user) => {
      setTargetUser(user);
      if (!user || user.role !== 'employee') {
        setIsEmployee(false);
        return;
      }
      setIsEmployee(true);
      setPermissions(resolveEmployeePermissions(user));
    });
    return unsub;
  }, [userId]);

  const persistPermissions = async (next: EmployeePermissions) => {
    setPermissions(next);
    setLoading(true);
    try {
      await updateEmployeePermissions(userId, next);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (field: keyof EmployeePermissions) => {
    const next = {...permissions, [field]: !permissions[field]};
    void persistPermissions(next);
  };

  const handleDelete = () => {
    if (!targetUser || !canDeleteUser(currentUser, targetUser, authEmail)) {
      return;
    }

    Alert.alert(t('deleteEmployee'), t('deleteEmployeeConfirm', {name: screenTitle}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              await deleteUser(userId);
              Alert.alert(t('employeeDeleted'));
              navigation.popToTop();
            } catch (error) {
              Alert.alert(t('error'), t(getDeleteUserErrorKey(error)));
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  if (!isAdmin) {
    return null;
  }

  if (!isEmployee) {
    return (
      <EmployeeManagementScreenLayout title={screenTitle}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </EmployeeManagementScreenLayout>
    );
  }

  return (
    <>
      <EmployeeManagementScreenLayout title={screenTitle}>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
          {t('employeePermissionsHint')}
        </Text>

        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
          {t('employeePermissions')}
        </Text>

        {PERMISSION_OPTIONS.map((option) => (
          <View key={option.field} style={[styles.row, listCard, layoutStyle]}>
            <View style={styles.rowText}>
              <MaterialCommunityIcons name={option.icon as any} size={22} color={theme.colors.primary} />
              <Text style={[styles.rowLabel, textStyle, {color: theme.typography.primary}]}>
                {t(option.labelKey)}
              </Text>
            </View>
            <Switch
              value={permissions[option.field]}
              onValueChange={() => togglePermission(option.field)}
              trackColor={{false: theme.colors.inputBorder, true: theme.colors.primaryLight}}
              thumbColor={permissions[option.field] ? theme.colors.primary : theme.colors.surface}
            />
          </View>
        ))}

        <AppButton
          label={t('deleteEmployee')}
          variant="danger"
          onPress={handleDelete}
          style={styles.deleteBtn}
          disabled={!targetUser || !canDeleteUser(currentUser, targetUser, authEmail)}
        />
      </EmployeeManagementScreenLayout>
      <LoadingOverlay visible={loading} />
    </>
  );
};

export default EmployeePermissionsScreen;
