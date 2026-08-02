import React, {useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Constants from 'expo-constants';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import BottomSheet from '@app/components/common/BottomSheet';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenHeader from '@app/components/common/ScreenHeader';
import SettingsAccountSection from '@app/components/settings/SettingsAccountSection';
import SettingsOptionRow from '@app/components/settings/SettingsOptionRow';
import {isMockMode} from '@app/config/appMode';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {useMockDb} from '@app/mock/mockDb';
import AppInput from '@app/components/common/AppInput';
import {
  DataResetPasswordError,
  verifyDataResetPassword,
} from '@app/services/auth.service';
import {clearAllBusinessData} from '@app/services/adminDataReset.service';
import {collectAdminBackupData} from '@app/services/adminBackupData.service';
import {hasDedicatedDataResetPassword} from '@app/config/dataResetAccess';
import {useAuthStore} from '@app/stores/authStore';
import {useAttendanceWorkplaceStore} from '@app/stores/attendanceWorkplaceStore';
import type {SettingsStackParamList} from '@app/types/navigation';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {exportAdminBackupReport} from '@app/utils/exportAdminBackupReport';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type BottomSheetType = 'language' | 'theme' | 'clearDataPassword' | null;

const languageOptions = [
  {key: 'en' as const, labelKey: 'english', icon: 'alphabetical'},
  {key: 'ar' as const, labelKey: 'arabic', icon: 'translate'},
];

const themeOptions = [
  {key: 'light' as const, labelKey: 'light', icon: 'weather-sunny'},
  {key: 'dark' as const, labelKey: 'dark', icon: 'weather-night'},
];

type SettingsNav = NativeStackNavigationProp<SettingsStackParamList, 'SettingsHome'>;

const SettingsScreen: React.FC = () => {
  const [bottomSheet, setBottomSheet] = useState<BottomSheetType>(null);
  const [clearingAllData, setClearingAllData] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [dataResetPassword, setDataResetPassword] = useState('');
  const [verifyingResetPassword, setVerifyingResetPassword] = useState(false);
  const navigation = useNavigation<SettingsNav>();
  const {theme, themePreference, setTheme} = useTheme();
  const {language, changeLanguage} = useLanguage();
  const {t} = useTranslation();
  const user = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const logout = useAuthStore((s) => s.logout);
  const attendanceWorkplace = useAttendanceWorkplaceStore((s) => s.workplace);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const isAdmin = user?.role === 'admin';
  const showPrimaryAdminTools = isPrimaryAdmin(user, authEmail);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.backgrounds.background},
        content: {
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
        },
        sectionLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          color: theme.typography.secondary,
          marginBottom: theme.spacing.xs,
          marginTop: theme.spacing.md,
          paddingHorizontal: theme.spacing.xs,
        },
        groupCard: {
          overflow: 'hidden',
          marginBottom: theme.spacing.xs,
        },
        aboutRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
        },
        aboutIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
        aboutTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        aboutVersion: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
        demoCard: {
          padding: theme.spacing.md,
          marginTop: theme.spacing.sm,
        },
        adminCard: {
          padding: theme.spacing.md,
          marginTop: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        adminHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
        demoHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.sm,
        },
        logoutWrap: {marginTop: theme.spacing.lg},
        sheetItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceSecondary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        sheetItemActive: {
          backgroundColor: theme.colors.primary,
        },
        sheetItemLabel: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        sheetCancel: {
          marginTop: theme.spacing.xs,
          paddingVertical: theme.spacing.md,
          alignItems: 'center',
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        sheetCancelText: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          color: theme.typography.secondary,
        },
        passwordSheetHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.sm,
        },
        passwordSheetActions: {gap: theme.spacing.sm, marginTop: theme.spacing.sm},
      }),
    [theme],
  );

  const currentLanguage = languageOptions.find((option) => option.key === language) ?? languageOptions[0];
  const currentTheme = themeOptions.find((option) => option.key === themePreference) ?? themeOptions[0];

  const handleSelectLanguage = (key: 'en' | 'ar') => {
    setBottomSheet(null);
    void changeLanguage(key);
  };

  const handleSelectTheme = (key: 'light' | 'dark') => {
    setTheme(key);
    setBottomSheet(null);
  };

  const resetDataPasswordField = () => setDataResetPassword('');

  const resolveDataResetPasswordError = (error: unknown): string => {
    if (error instanceof DataResetPasswordError) {
      switch (error.code) {
        case 'WRONG_PASSWORD':
          return t('settingsClearAllDataWrongPassword');
        case 'NOT_CONFIGURED':
          return t('settingsClearAllDataPasswordNotConfigured');
        case 'NOT_SIGNED_IN':
          return t('settingsClearAllDataNotSignedIn');
        default:
          break;
      }
    }
    return t('settingsClearAllDataFailed');
  };

  const runClearAllBusinessData = () => {
    void (async () => {
      setClearingAllData(true);
      try {
        await clearAllBusinessData(user, authEmail);
        Alert.alert(t('settingsClearAllDataDoneTitle'), t('settingsClearAllDataDoneMessage'));
      } catch (error) {
        console.error('[SettingsScreen] clearAllBusinessData failed', error);
        Alert.alert(t('error'), t('settingsClearAllDataFailed'));
      } finally {
        setClearingAllData(false);
      }
    })();
  };

  const confirmClearAllDataAfterPassword = () => {
    Alert.alert(t('settingsClearAllDataTitle'), t('settingsClearAllDataConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('settingsClearAllDataAction'),
        style: 'destructive',
        onPress: runClearAllBusinessData,
      },
    ]);
  };

  const handleSubmitClearAllDataPassword = () => {
    void (async () => {
      setVerifyingResetPassword(true);
      try {
        await verifyDataResetPassword(dataResetPassword);
        resetDataPasswordField();
        setBottomSheet(null);
        confirmClearAllDataAfterPassword();
      } catch (error) {
        Alert.alert(t('error'), resolveDataResetPasswordError(error));
      } finally {
        setVerifyingResetPassword(false);
      }
    })();
  };

  const handleClearAllData = () => {
    resetDataPasswordField();
    setBottomSheet('clearDataPassword');
  };

  const handleExportBackup = () => {
    void (async () => {
      setExportingBackup(true);
      try {
        const snapshot = await collectAdminBackupData(user, authEmail);
        await exportAdminBackupReport(snapshot, t, {
          isRtl: language === 'ar',
          appName: t('appName'),
        });
      } catch (error) {
        console.error('[SettingsScreen] export backup failed', error);
        Alert.alert(t('error'), t('settingsExportBackupFailed'));
      } finally {
        setExportingBackup(false);
      }
    })();
  };

  const sheetTitle =
    bottomSheet === 'language'
      ? t('chooseLanguage')
      : bottomSheet === 'theme'
        ? t('chooseTheme')
        : bottomSheet === 'clearDataPassword'
          ? t('settingsClearAllDataPasswordTitle')
          : '';
  const sheetOptions = bottomSheet === 'language' ? languageOptions : themeOptions;
  const selectedKey = bottomSheet === 'language' ? language : themePreference;
  const dataResetPasswordHint = hasDedicatedDataResetPassword()
    ? t('settingsClearAllDataPasswordHintDedicated')
    : isMockMode
      ? t('settingsClearAllDataPasswordHintMock')
      : t('settingsClearAllDataPasswordHintLogin');

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settingsScreenTitle')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {user ? <SettingsAccountSection user={user} authEmail={authEmail} /> : null}

        <Text style={styles.sectionLabel}>{t('settingsPreferences')}</Text>
        <View style={[styles.groupCard, listCard]}>
          <SettingsOptionRow
            icon={currentLanguage.icon}
            iconColor={theme.colors.primary}
            iconBackground={`${theme.colors.primary}18`}
            label={t('language')}
            value={t(currentLanguage.labelKey)}
            onPress={() => setBottomSheet('language')}
            showDivider
          />
          <SettingsOptionRow
            icon={currentTheme.icon}
            iconColor={theme.colors.warning}
            iconBackground={theme.colors.surfaceSecondary}
            label={t('themeMode')}
            value={t(currentTheme.labelKey)}
            onPress={() => setBottomSheet('theme')}
          />
        </View>

        {isAdmin ? (
          <>
            <Text style={styles.sectionLabel}>{t('settingsAdminSection')}</Text>
            <View style={[styles.groupCard, listCard]}>
              <SettingsOptionRow
                icon="map-marker-radius"
                iconColor={theme.colors.primary}
                iconBackground={`${theme.colors.primary}18`}
                label={t('settingsAttendanceWorkplaceTitle')}
                value={attendanceWorkplace?.name ?? t('settingsAttendanceWorkplaceUnset')}
                onPress={() => navigation.navigate('AttendanceWorkplaceSettings')}
              />
            </View>
            <View style={[styles.adminCard, listCard]}>
              <Text style={[styles.adminHint, {color: theme.typography.secondary}]}>
                {t('settingsExportBackupHint')}
              </Text>
              <AppButton
                label={t('settingsExportBackup')}
                variant="outline"
                onPress={handleExportBackup}
                loading={exportingBackup}
                disabled={exportingBackup}
              />
            </View>
          </>
        ) : null}

        {showPrimaryAdminTools ? (
          <>
            <Text style={styles.sectionLabel}>{t('settingsPrimaryAdminSection')}</Text>
          <View style={[styles.adminCard, listCard]}>
            <Text style={[styles.adminHint, {color: theme.typography.secondary}]}>
              {t('settingsClearAllDataHint')}
            </Text>
            <AppButton
              label={t('settingsClearAllData')}
              variant="danger"
              onPress={handleClearAllData}
              loading={clearingAllData}
              disabled={clearingAllData}
            />
          </View>
          </>
        ) : null}

        {isMockMode ? (
          <>
            <Text style={styles.sectionLabel}>{t('demoMode')}</Text>
            <View style={[styles.demoCard, listCard]}>
              <Text style={[styles.demoHint, {color: theme.typography.secondary}]}>{t('demoModeHint')}</Text>
              <AppButton
                label={t('resetDemoData')}
                variant="outline"
                onPress={() => useMockDb.getState().reset()}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('settingsAbout')}</Text>
        <View style={[styles.groupCard, listCard]}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutIconWrap}>
              <MaterialCommunityIcons name="application-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.aboutTitle, {color: theme.typography.primary}]}>{t('appName')}</Text>
              <Text style={[styles.aboutVersion, {color: theme.typography.secondary}]}>
                {t('appVersion')} {appVersion}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <AppButton label={t('logout')} variant="danger" onPress={() => void logout().catch(() => undefined)} />
        </View>
      </ScrollView>

      <BottomSheet
        visible={bottomSheet !== null}
        title={sheetTitle}
        formFields={bottomSheet === 'clearDataPassword' ? ['settingsClearAllDataPassword'] : undefined}
        onClose={() => {
          if (bottomSheet === 'clearDataPassword') {
            resetDataPasswordField();
          }
          setBottomSheet(null);
        }}
      >
        {bottomSheet === 'clearDataPassword' ? (
          <>
            <Text style={[styles.passwordSheetHint, {color: theme.typography.secondary}]}>
              {dataResetPasswordHint}
            </Text>
            <AppInput
              fieldKey="settingsClearAllDataPassword"
              label={t('settingsClearAllDataPasswordLabel')}
              value={dataResetPassword}
              onChangeText={setDataResetPassword}
              secureTextEntry
              autoComplete="password"
            />
            <View style={styles.passwordSheetActions}>
              <AppButton
                label={t('confirm')}
                variant="danger"
                onPress={handleSubmitClearAllDataPassword}
                loading={verifyingResetPassword}
                disabled={verifyingResetPassword || !dataResetPassword.trim()}
              />
              <Pressable
                style={styles.sheetCancel}
                onPress={() => {
                  resetDataPasswordField();
                  setBottomSheet(null);
                }}
              >
                <Text style={styles.sheetCancelText}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          sheetOptions.map((option) => {
          const selected = selectedKey === option.key;
          const label = t(option.labelKey);
          return (
            <Pressable
              key={option.key}
              style={[styles.sheetItem, selected && styles.sheetItemActive]}
              onPress={() =>
                bottomSheet === 'language'
                  ? handleSelectLanguage(option.key as 'en' | 'ar')
                  : handleSelectTheme(option.key as 'light' | 'dark')
              }
            >
              <MaterialCommunityIcons
                name={option.icon as any}
                size={22}
                color={selected ? theme.colors.onPrimary : theme.typography.primary}
              />
              <Text
                style={[
                  styles.sheetItemLabel,
                  {color: selected ? theme.colors.onPrimary : theme.typography.primary},
                ]}
              >
                {label}
              </Text>
              {selected ? (
                <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.onPrimary} />
              ) : null}
            </Pressable>
          );
        })
        )}
        {bottomSheet === 'language' || bottomSheet === 'theme' ? (
          <Pressable style={styles.sheetCancel} onPress={() => setBottomSheet(null)}>
            <Text style={styles.sheetCancelText}>{t('cancel')}</Text>
          </Pressable>
        ) : null}
      </BottomSheet>

      <LoadingOverlay visible={clearingAllData || verifyingResetPassword || exportingBackup} />
    </View>
  );
};

export default SettingsScreen;

