import React, {useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import SettingsProfileCard from '@app/components/settings/SettingsProfileCard';
import {isMockMode} from '@app/config/appMode';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {changeCurrentUserPassword} from '@app/services/auth.service';
import {updateUserName} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {TFunction} from 'i18next';

interface Props {
  user: AppUser;
  authEmail: string | null;
}

function resolvePasswordChangeError(error: unknown, t: TFunction): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as {code: string}).code) : '';

  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return t('settingsWrongCurrentPassword');
    case 'auth/weak-password':
      return t('settingsNewPasswordTooShort');
    case 'auth/requires-recent-login':
      return t('settingsPasswordRequiresRecentLogin');
    default:
      return t('settingsChangePasswordFailed');
  }
}

const SettingsAccountSection: React.FC<Props> = ({user, authEmail}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, chevronForward, ltrTextStyle} = useDirection();

  const [menuOpen, setMenuOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          color: theme.typography.secondary,
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.spacing.xs,
        },
        sheetItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceSecondary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        sheetItemDisabled: {
          opacity: 0.55,
        },
        sheetItemLabel: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        sheetItemHint: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
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
        formFields: {
          gap: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        },
        emailRow: {
          paddingHorizontal: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
        },
        emailText: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
      }),
    [theme],
  );

  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleOpenNameSheet = () => {
    setMenuOpen(false);
    setEditedName(user.name);
    setNameSheetOpen(true);
  };

  const handleOpenPasswordSheet = () => {
    if (isMockMode) {
      Alert.alert(t('demoMode'), t('settingsChangePasswordMockHint'));
      return;
    }
    setMenuOpen(false);
    resetPasswordFields();
    setPasswordSheetOpen(true);
  };

  const handleSaveName = () => {
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      Alert.alert(t('error'), t('settingsEditMyNameRequired'));
      return;
    }

    if (trimmedName === user.name.trim()) {
      setNameSheetOpen(false);
      return;
    }

    void (async () => {
      setBusy(true);
      try {
        const updated = await updateUserName(user.id, trimmedName);
        useAuthStore.setState({user: updated});
        setNameSheetOpen(false);
        Alert.alert(t('settingsEditMyNameDoneTitle'), t('settingsEditMyNameDoneMessage'));
      } catch (error) {
        console.error('[SettingsAccountSection] updateUserName failed', error);
        Alert.alert(t('error'), t('saveFailed'));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleSavePassword = () => {
    if (!currentPassword.trim()) {
      Alert.alert(t('error'), t('settingsCurrentPasswordRequired'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('error'), t('settingsNewPasswordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('settingsPasswordMismatch'));
      return;
    }

    void (async () => {
      setBusy(true);
      try {
        await changeCurrentUserPassword(currentPassword, newPassword);
        resetPasswordFields();
        setPasswordSheetOpen(false);
        Alert.alert(t('settingsChangePasswordDoneTitle'), t('settingsChangePasswordDoneMessage'));
      } catch (error) {
        console.error('[SettingsAccountSection] changeCurrentUserPassword failed', error);
        Alert.alert(t('error'), resolvePasswordChangeError(error, t));
      } finally {
        setBusy(false);
      }
    })();
  };

  const emailPreview = authEmail ?? user.email ?? '';

  return (
    <>
      <Text style={styles.sectionLabel}>{t('settingsAccountSection')}</Text>
      {emailPreview ? (
        <View style={styles.emailRow}>
          <Text style={[styles.emailText, ltrTextStyle, textStyle, {color: theme.typography.secondary}]}>
            {emailPreview}
          </Text>
        </View>
      ) : null}

      <SettingsProfileCard user={user} onPress={() => setMenuOpen(true)} />

      <BottomSheet
        visible={menuOpen}
        title={t('settingsProfileMenuTitle')}
        onClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.sheetItem} onPress={handleOpenNameSheet}>
          <MaterialCommunityIcons name="account-edit-outline" size={22} color={theme.typography.primary} />
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={[styles.sheetItemLabel, textStyle, {color: theme.typography.primary}]}>
              {t('settingsEditMyName')}
            </Text>
            <Text
              style={[styles.sheetItemHint, ltrTextStyle, {color: theme.typography.secondary}]}
              numberOfLines={1}
            >
              {user.name}
            </Text>
          </View>
          <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
        </Pressable>

        <Pressable
          style={[styles.sheetItem, isMockMode ? styles.sheetItemDisabled : null]}
          onPress={handleOpenPasswordSheet}
        >
          <MaterialCommunityIcons name="lock-reset" size={22} color={theme.typography.primary} />
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={[styles.sheetItemLabel, textStyle, {color: theme.typography.primary}]}>
              {t('settingsChangePassword')}
            </Text>
            <Text style={[styles.sheetItemHint, textStyle, {color: theme.typography.secondary}]}>
              {isMockMode ? t('settingsChangePasswordMockHint') : t('settingsChangePasswordHint')}
            </Text>
          </View>
          <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
        </Pressable>

        <Pressable style={styles.sheetCancel} onPress={() => setMenuOpen(false)}>
          <Text style={styles.sheetCancelText}>{t('cancel')}</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet
        visible={nameSheetOpen}
        title={t('settingsEditMyName')}
        onClose={() => setNameSheetOpen(false)}
        formFields={['settingsAccountName']}
      >
        <View style={styles.formFields}>
          <AppInput
            fieldKey="settingsAccountName"
            label={t('userName')}
            value={editedName}
            onChangeText={setEditedName}
            placeholder={t('settingsEditMyNamePlaceholder')}
          />
          <AppButton label={t('saveChanges')} onPress={handleSaveName} loading={busy} disabled={busy} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={passwordSheetOpen}
        title={t('settingsChangePassword')}
        onClose={() => setPasswordSheetOpen(false)}
        formFields={['settingsCurrentPassword', 'settingsNewPassword', 'settingsConfirmPassword']}
      >
        <View style={styles.formFields}>
          <AppInput
            fieldKey="settingsCurrentPassword"
            label={t('settingsCurrentPassword')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoComplete="password"
          />
          <AppInput
            fieldKey="settingsNewPassword"
            label={t('settingsNewPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="password-new"
          />
          <AppInput
            fieldKey="settingsConfirmPassword"
            label={t('settingsConfirmNewPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="password-new"
          />
          <AppButton label={t('saveChanges')} onPress={handleSavePassword} loading={busy} disabled={busy} />
        </View>
      </BottomSheet>

      <LoadingOverlay visible={busy} />
    </>
  );
};

export default SettingsAccountSection;
