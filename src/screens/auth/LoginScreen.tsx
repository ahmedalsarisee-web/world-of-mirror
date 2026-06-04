import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {isFirebaseConfigured} from '@app/config/firebase';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import FormScreen from '@app/components/common/FormScreen';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {MOCK_LOGIN_OPTIONS} from '@app/mock/mockUsers';
import {useAuthStore} from '@app/stores/authStore';

const LOGIN_LOGO = require('../../../assets/login-icon.png');

const LoginScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const {login, loginAsMock, isLoading, error, clearError} = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    try {
      await login(email.trim(), password);
    } catch {
      // error handled in store
    }
  };

  return (
    <FormScreen fields={['email', 'password']}>
      <View style={styles.header}>
        <Image source={LOGIN_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel={t('appName')} />
        <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{t('appName')}</Text>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>{t('loginSubtitle')}</Text>
      </View>

      {isMockMode ? (
        <View style={[styles.demoBanner, {backgroundColor: theme.colors.primary + '22'}]}>
          <Text style={[styles.demoTitle, textStyle, {color: theme.colors.primary}]}>{t('demoMode')}</Text>
          <Text style={[styles.demoHint, textStyle, {color: theme.typography.secondary}]}>{t('demoModeHint')}</Text>
        </View>
      ) : null}

      {!isMockMode && !isFirebaseConfigured ? (
        <View style={[styles.configBanner, {backgroundColor: theme.status.error + '22'}]}>
          <Text style={[styles.configTitle, textStyle, {color: theme.status.error}]}>{t('firebaseNotConfigured')}</Text>
          <Text style={[styles.configHint, textStyle, {color: theme.typography.secondary}]}>
            {t('firebaseNotConfiguredHint')}
          </Text>
        </View>
      ) : null}

      {isMockMode ? (
        <View style={styles.mockSection}>
          <Text style={[styles.mockLabel, textStyle, {color: theme.typography.primary}]}>{t('chooseDemoUser')}</Text>
          {MOCK_LOGIN_OPTIONS.map((option) => (
            <AppButton
              key={option.id}
              label={option.label}
              variant={option.role === 'admin' ? 'primary' : 'outline'}
              onPress={() => void loginAsMock(option.id)}
              loading={isLoading}
              style={styles.mockBtn}
            />
          ))}
        </View>
      ) : (
        <>
          <AppInput
            fieldKey="email"
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <AppInput
            fieldKey="password"
            label={t('password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <AppButton label={t('login')} onPress={handleLogin} loading={isLoading} style={styles.btn} />
        </>
      )}

      {error ? <Text style={[styles.error, textStyle, {color: theme.status.error}]}>{error}</Text> : null}
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  header: {marginBottom: 24, marginTop: 40, alignItems: 'center'},
  logo: {width: 280, height: 140, marginBottom: 16},
  title: {fontSize: 28, fontWeight: '800'},
  subtitle: {fontSize: 15, marginTop: 8},
  error: {marginTop: 12, fontSize: 14},
  btn: {marginTop: 8},
  configBanner: {borderRadius: 10, padding: 14, marginBottom: 20},
  configTitle: {fontSize: 15, fontWeight: '700', marginBottom: 6},
  configHint: {fontSize: 13, lineHeight: 18},
  demoBanner: {borderRadius: 10, padding: 14, marginBottom: 20},
  demoTitle: {fontSize: 15, fontWeight: '700', marginBottom: 6},
  demoHint: {fontSize: 13, lineHeight: 18},
  mockSection: {gap: 10},
  mockLabel: {fontSize: 16, fontWeight: '600', marginBottom: 4},
  mockBtn: {marginBottom: 0},
});

export default LoginScreen;
