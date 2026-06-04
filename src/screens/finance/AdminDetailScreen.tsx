import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Switch, Text, View} from 'react-native';
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
import {deleteUser, subscribeToUser, updateAdminPermissions} from '@app/services/users.service';
import {getDeleteUserErrorKey} from '@app/services/auth.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AdminPermissions, AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {
  ADMIN_PERMISSION_OPTIONS,
  canDeleteUser,
  canManageAdmins,
  resolveAdminPermissions,
} from '@app/utils/adminPermissions';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Route = RouteProp<EmployeeManagementStackParamList, 'AdminDetail'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'AdminDetail'>;

const AdminDetailScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, chevronForward, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const [admin, setAdmin] = useState<AppUser | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissions>(
    resolveAdminPermissions(null),
  );
  const [loading, setLoading] = useState(false);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const canManage = canManageAdmins(currentUser, authEmail);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {fontSize: 22, fontWeight: '700', marginBottom: 4},
        subtitle: {fontSize: 14, marginBottom: 20, lineHeight: 20},
        card: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 10,
          gap: 8,
        },
        textWrap: {flex: 1},
        cardTitle: {fontSize: 16, fontWeight: '600', marginBottom: 4},
        cardSubtitle: {fontSize: 13, lineHeight: 18},
        badge: {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          marginBottom: 16,
        },
        badgeText: {fontSize: 12, fontWeight: '700'},
        sectionTitle: {fontSize: 16, fontWeight: '600', marginBottom: 12},
        permRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 10,
          gap: 12,
        },
        permRowText: {flex: 1, flexDirection: row, alignItems: 'center', gap: 12},
        permRowLabel: {fontSize: 15, fontWeight: '600'},
        deleteBtn: {marginTop: 24},
      }),
    [row],
  );

  useEffect(() => {
    if (!canManage) {
      navigation.goBack();
    }
  }, [canManage, navigation]);

  useEffect(() => {
    return subscribeToUser(userId, (user) => {
      setAdmin(user);
      if (user?.role === 'admin') {
        setAdminPermissions(resolveAdminPermissions(user));
      }
    });
  }, [userId]);

  const persistAdminPermissions = async (next: AdminPermissions) => {
    setAdminPermissions(next);
    setLoading(true);
    try {
      await updateAdminPermissions(userId, next);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminPermission = (field: keyof AdminPermissions) => {
    const next = {...adminPermissions, [field]: !adminPermissions[field]};
    void persistAdminPermissions(next);
  };

  const handleDelete = () => {
    if (!admin || !currentUser || !canDeleteUser(currentUser, admin, authEmail)) {
      return;
    }

    Alert.alert(t('deleteAdmin'), t('deleteAdminConfirm', {name: userName}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            try {
              await deleteUser(userId);
              Alert.alert(t('adminDeleted'));
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

  if (!canManage) {
    return null;
  }

  if (!admin) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  const showDelete = canDeleteUser(currentUser, admin, authEmail);

  return (
    <>
      <ScreenContainer>
        <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{userName}</Text>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
          {admin.email ?? t('adminAccountHint')}
        </Text>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: admin.isPrimaryAdmin
                ? `${theme.colors.primary}18`
                : theme.colors.surfaceSecondary,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              textStyle,
              {color: admin.isPrimaryAdmin ? theme.colors.primary : theme.typography.secondary},
            ]}
          >
            {admin.isPrimaryAdmin ? t('primaryAdminRole') : t('adminRole')}
          </Text>
        </View>

        {!admin.isPrimaryAdmin ? (
          <>
            <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
              {t('adminPermissions')}
            </Text>
            <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
              {t('adminPermissionsHint')}
            </Text>
            {ADMIN_PERMISSION_OPTIONS.map((option) => (
              <View key={option.field} style={[styles.permRow, listCard, layoutStyle]}>
                <View style={styles.permRowText}>
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={22}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.permRowLabel, textStyle, {color: theme.typography.primary}]}>
                    {t(option.labelKey)}
                  </Text>
                </View>
                <Switch
                  value={adminPermissions[option.field]}
                  onValueChange={() => toggleAdminPermission(option.field)}
                  trackColor={{false: theme.colors.inputBorder, true: theme.colors.primaryLight}}
                  thumbColor={
                    adminPermissions[option.field] ? theme.colors.primary : theme.colors.surface
                  }
                />
              </View>
            ))}
          </>
        ) : null}

        <Pressable
          style={[styles.card, listCard, layoutStyle]}
          onPress={() => {
            const tabNavigation = navigation.getParent()?.getParent();
            tabNavigation?.navigate('FinanceTab', {
              screen: 'EmployeeAccount',
              params: {userId, userName},
            });
          }}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}>
              {t('finance')}
            </Text>
            <Text style={[styles.cardSubtitle, textStyle, {color: theme.typography.secondary}]}>
              {t('adminFinanceHint')}
            </Text>
          </View>
          <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
        </Pressable>

        {showDelete ? (
          <AppButton
            label={t('deleteAdmin')}
            variant="danger"
            onPress={handleDelete}
            style={styles.deleteBtn}
          />
        ) : null}
      </ScreenContainer>
      <LoadingOverlay visible={loading} />
    </>
  );
};

export default AdminDetailScreen;
