import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Switch, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {deleteUser, subscribeToUser, updateEmployeePermissions} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {EmployeePermissionModule, EmployeePermissions, AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {canDeleteUser} from '@app/utils/adminPermissions';
import {getDefaultEmployeePermissions, resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeePermissions'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeePermissions'>;

const PERMISSION_OPTIONS: {key: EmployeePermissionModule; labelKey: string; icon: string}[] = [
  {key: 'finance', labelKey: 'permissionFinance', icon: 'cash-multiple'},
];

const EmployeePermissionsScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const currentUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const isAdmin = currentUser?.role === 'admin';
  const [permissions, setPermissions] = useState<EmployeePermissions>(getDefaultEmployeePermissions());
  const [loading, setLoading] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {fontSize: 22, fontWeight: '700', marginBottom: 4},
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
    const unsub = subscribeToUser(route.params.userId, (user) => {
      setTargetUser(user);
      if (!user || user.role !== 'employee') {
        setIsEmployee(false);
        return;
      }
      setIsEmployee(true);
      setPermissions(resolveEmployeePermissions(user));
    });
    return unsub;
  }, [route.params.userId]);

  const persistPermissions = async (next: EmployeePermissions) => {
    setPermissions(next);
    setLoading(true);
    try {
      await updateEmployeePermissions(route.params.userId, next);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (key: EmployeePermissionModule) => {
    const next = {...permissions, [key]: !permissions[key]};
    void persistPermissions(next);
  };

  const handleDelete = () => {
    if (!targetUser || !canDeleteUser(currentUser, targetUser, authEmail)) {
      return;
    }

    Alert.alert(t('deleteEmployee'), t('deleteEmployeeConfirm', {name: route.params.userName}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              await deleteUser(route.params.userId);
              Alert.alert(t('employeeDeleted'));
              navigation.popToTop();
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
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
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <>
      <ScreenContainer>
        <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{route.params.userName}</Text>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
          {t('employeePermissionsHint')}
        </Text>

        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
          {t('employeePermissions')}
        </Text>

        {PERMISSION_OPTIONS.map((option) => (
          <View key={option.key} style={[styles.row, listCard, layoutStyle]}>
            <View style={styles.rowText}>
              <MaterialCommunityIcons name={option.icon as any} size={22} color={theme.colors.primary} />
              <Text style={[styles.rowLabel, textStyle, {color: theme.typography.primary}]}>
                {t(option.labelKey)}
              </Text>
            </View>
            <Switch
              value={permissions[option.key]}
              onValueChange={() => togglePermission(option.key)}
              trackColor={{false: theme.colors.inputBorder, true: theme.colors.primaryLight}}
              thumbColor={permissions[option.key] ? theme.colors.primary : theme.colors.surface}
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
      </ScreenContainer>
      <LoadingOverlay visible={loading} />
    </>
  );
};

export default EmployeePermissionsScreen;
