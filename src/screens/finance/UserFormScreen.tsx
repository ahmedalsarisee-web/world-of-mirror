import React, {useEffect} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import FormScreen from '@app/components/common/FormScreen';
import {getAuthErrorMessage} from '@app/services/auth.service';
import {createUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import type {UserRole} from '@app/types/models';
import {userSchema, type UserFormValues} from '@app/utils/validation';

type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'UserForm'>;

const ROLE_OPTIONS: UserRole[] = ['employee', 'admin'];

const UserFormScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, centeredTextStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';

  const {control, handleSubmit, formState: {errors, isSubmitting}} = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {name: '', email: '', password: '', role: 'employee'},
  });

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  const onSubmit = async (values: UserFormValues) => {
    const parsed = userSchema.parse(values);
    try {
      await createUser(parsed);
      Alert.alert(t('userCreated'), t('userCreatedHint'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('error'), getAuthErrorMessage(error));
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <FormScreen fields={['name', 'email', 'password']}>
        <Text style={[styles.title, textStyle]}>{t('addUser')}</Text>

        <Controller
          control={control}
          name="name"
          render={({field: {onChange, onBlur, value}}) => (
            <AppInput
              fieldKey="name"
              label={t('userName')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({field: {onChange, onBlur, value}}) => (
            <AppInput
              fieldKey="email"
              label={t('email')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({field: {onChange, onBlur, value}}) => (
            <AppInput
              fieldKey="password"
              label={t('password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              error={errors.password?.message}
            />
          )}
        />

        <Text style={[styles.roleLabel, textStyle, {color: theme.typography.secondary}]}>
          {t('userRole')}
        </Text>
        <Controller
          control={control}
          name="role"
          render={({field: {onChange, value}}) => (
            <View style={[styles.roleRow, {flexDirection: row}]}>
              {ROLE_OPTIONS.map((role) => {
                const selected = value === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => onChange(role)}
                    style={[
                      styles.roleOption,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.inputBorder,
                        backgroundColor: selected ? theme.colors.primary : theme.colors.inputBackground,
                        borderRadius: theme.components.input.radius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        centeredTextStyle,
                        {color: selected ? theme.colors.onPrimary : theme.typography.primary},
                      ]}
                    >
                      {role === 'admin' ? t('adminRole') : t('employeeRole')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />

        <AppButton
          label={t('createUser')}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </FormScreen>
      <LoadingOverlay visible={isSubmitting} />
    </>
  );
};

const styles = StyleSheet.create({
  title: {fontSize: 20, fontWeight: '700', marginBottom: 20},
  roleLabel: {fontSize: 13, marginBottom: 8},
  roleRow: {gap: 10, marginBottom: 20},
  roleOption: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  roleText: {fontSize: 15, fontWeight: '600'},
  submitButton: {marginTop: 4},
});

export default UserFormScreen;
