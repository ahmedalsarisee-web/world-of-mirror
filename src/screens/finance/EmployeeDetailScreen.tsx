import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {formatPermissionSummary, resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {formatEmployeeLocationUpdatedAt} from '@app/utils/employeeLocationDisplay';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeDetail'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeDetail'>;

const EmployeeDetailScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, chevronForward, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [employee, setEmployee] = useState<AppUser | null>(null);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {fontSize: 22, fontWeight: '700', marginBottom: 20},
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
      }),
    [row],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    return subscribeToUser(userId, setEmployee);
  }, [userId]);

  if (!isAdmin) {
    return null;
  }

  if (!employee) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{userName}</Text>

      <Pressable
        style={[styles.card, listCard, layoutStyle]}
        onPress={() => navigation.navigate('EmployeePermissions', {userId, userName})}
      >
        <View style={styles.textWrap}>
          <Text style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}>
            {t('employeePermissions')}
          </Text>
          <Text style={[styles.cardSubtitle, textStyle, {color: theme.typography.secondary}]}>
            {formatPermissionSummary(resolveEmployeePermissions(employee), t)}
          </Text>
        </View>
        <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
      </Pressable>

      <Pressable
        style={[styles.card, listCard, layoutStyle]}
        onPress={() => navigation.navigate('EmployeeLocation', {userId, userName})}
      >
        <View style={styles.textWrap}>
          <Text style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}>
            {t('employeeLocation')}
          </Text>
          <Text style={[styles.cardSubtitle, textStyle, {color: theme.typography.secondary}]}>
            {formatEmployeeLocationUpdatedAt(employee.lastLocation, t)}
          </Text>
        </View>
        <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
      </Pressable>

      <Pressable
        style={[styles.card, listCard, layoutStyle]}
        onPress={() => navigation.navigate('EmployeeAttendance', {userId, userName})}
      >
        <View style={styles.textWrap}>
          <Text style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}>
            {t('employeeAttendance')}
          </Text>
          <Text style={[styles.cardSubtitle, textStyle, {color: theme.typography.secondary}]}>
            {t('employeeAttendanceHint')}
          </Text>
        </View>
        <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
      </Pressable>
    </ScreenContainer>
  );
};

export default EmployeeDetailScreen;
