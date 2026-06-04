import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import AttendanceWorkplaceMapPicker from '@app/components/settings/AttendanceWorkplaceMapPicker';
import {DEFAULT_ATTENDANCE_WORKPLACE} from '@app/constants/attendanceLocation';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {saveAttendanceWorkplace} from '@app/services/attendanceWorkplace.service';
import {useAttendanceWorkplaceStore} from '@app/stores/attendanceWorkplaceStore';
import {useAuthStore} from '@app/stores/authStore';
import type {SettingsStackParamList} from '@app/types/navigation';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'AttendanceWorkplaceSettings'>;

const RADIUS_MIN = 30;
const RADIUS_MAX = 500;
const RADIUS_STEP = 10;
const RADIUS_PRESETS = [80, 120, 200] as const;
const MAP_HEIGHT = 220;

function initialWorkplaceFields(workplace: ReturnType<typeof useAttendanceWorkplaceStore.getState>['workplace']) {
  const source = workplace ?? DEFAULT_ATTENDANCE_WORKPLACE;
  const unsetCoords = source.latitude === 0 && source.longitude === 0;
  return {
    name: source.name ?? DEFAULT_ATTENDANCE_WORKPLACE.name,
    latitude: unsetCoords ? DEFAULT_ATTENDANCE_WORKPLACE.latitude : source.latitude,
    longitude: unsetCoords ? DEFAULT_ATTENDANCE_WORKPLACE.longitude : source.longitude,
    radiusMeters: source.radiusMeters > 0 ? source.radiusMeters : DEFAULT_ATTENDANCE_WORKPLACE.radiusMeters,
  };
}

const AttendanceWorkplaceSettingsScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, centeredTextStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const workplace = useAttendanceWorkplaceStore((s) => s.workplace);
  const initial = useMemo(() => initialWorkplaceFields(workplace), [workplace]);
  const [name, setName] = useState(initial.name);
  const [latitude, setLatitude] = useState(initial.latitude);
  const [longitude, setLongitude] = useState(initial.longitude);
  const [radiusMeters, setRadiusMeters] = useState(initial.radiusMeters);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigation.goBack();
    }
  }, [navigation, user?.role]);

  useEffect(() => {
    const next = initialWorkplaceFields(workplace);
    setName(next.name);
    setLatitude(next.latitude);
    setLongitude(next.longitude);
    setRadiusMeters(next.radiusMeters);
  }, [workplace]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 17,
        },
        mapCard: {
          gap: theme.spacing.xs,
        },
        mapHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 17,
        },
        mapHeight: {height: MAP_HEIGHT, width: '100%'},
        mapToolbar: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        locationBtn: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        locationBtnText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        coords: {
          flex: 1,
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 16,
        },
        panel: {
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        radiusRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        radiusLabel: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        radiusControls: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        radiusBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        radiusValue: {
          minWidth: 64,
          textAlign: 'center',
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        presetRow: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        },
        presetChip: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 6,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        presetChipActive: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        presetChipText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
      }),
    [row, theme],
  );

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationDeniedMessage'));
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });

      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
    } catch {
      Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationUnavailable'));
    } finally {
      setLocating(false);
    }
  }, [t]);

  const adjustRadius = (delta: number) => {
    setRadiusMeters((current) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, current + delta)));
  };

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('error'), t('settingsAttendanceWorkplaceNameRequired'));
      return;
    }

    setSaving(true);
    try {
      await saveAttendanceWorkplace(
        {
          name: trimmedName,
          latitude,
          longitude,
          radiusMeters,
        },
        user.id,
      );
      Alert.alert(t('settingsAttendanceWorkplaceSavedTitle'), t('settingsAttendanceWorkplaceSavedMessage'), [
        {text: t('done'), onPress: () => navigation.goBack()},
      ]);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [latitude, longitude, name, navigation, radiusMeters, t, user?.id]);

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <View style={{flex: 1, backgroundColor: theme.backgrounds.background}}>
      <ScreenContainer contentStyle={styles.content}>
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('settingsAttendanceWorkplaceHint')}
        </Text>

        <View style={styles.mapCard}>
          <Text style={[styles.mapHint, textStyle, {color: theme.typography.secondary}]}>
            {t('settingsAttendanceWorkplaceMapHint')}
          </Text>
          <AttendanceWorkplaceMapPicker
            style={styles.mapHeight}
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            onLocationChange={(nextLat, nextLng) => {
              setLatitude(nextLat);
              setLongitude(nextLng);
            }}
          />
          <View style={styles.mapToolbar}>
            <Pressable
              style={styles.locationBtn}
              onPress={() => void handleUseMyLocation()}
              disabled={locating}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={[styles.locationBtnText, textStyle, {color: theme.typography.primary}]}>
                {t('settingsAttendanceWorkplaceUseMyLocation')}
              </Text>
            </Pressable>
            <Text
              style={[styles.coords, textStyle, {color: theme.typography.secondary}]}
              numberOfLines={1}
            >
              {t('settingsAttendanceWorkplaceCoordinates', {
                lat: latitude.toFixed(5),
                lng: longitude.toFixed(5),
              })}
            </Text>
          </View>
        </View>

        <View style={[styles.panel, listCard]}>
          <AppInput label={t('settingsAttendanceWorkplaceName')} value={name} onChangeText={setName} />

          <View style={styles.radiusRow}>
            <Text style={[styles.radiusLabel, textStyle, {color: theme.typography.primary}]}>
              {t('settingsAttendanceWorkplaceRadius')}
            </Text>
            <View style={styles.radiusControls}>
              <Pressable
                style={styles.radiusBtn}
                onPress={() => adjustRadius(-RADIUS_STEP)}
                disabled={radiusMeters <= RADIUS_MIN}
              >
                <MaterialCommunityIcons name="minus" size={18} color={theme.typography.primary} />
              </Pressable>
              <Text style={[styles.radiusValue, centeredTextStyle, textStyle, {color: theme.typography.primary}]}>
                {t('settingsAttendanceWorkplaceRadiusValue', {meters: radiusMeters})}
              </Text>
              <Pressable
                style={styles.radiusBtn}
                onPress={() => adjustRadius(RADIUS_STEP)}
                disabled={radiusMeters >= RADIUS_MAX}
              >
                <MaterialCommunityIcons name="plus" size={18} color={theme.typography.primary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.presetRow}>
            {RADIUS_PRESETS.map((preset) => {
              const active = radiusMeters === preset;
              return (
                <Pressable
                  key={preset}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setRadiusMeters(preset)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      textStyle,
                      {color: active ? theme.colors.primary : theme.typography.secondary},
                    ]}
                  >
                    {t('settingsAttendanceWorkplaceRadiusValue', {meters: preset})}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <AppButton
            label={t('saveChanges')}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={saving}
          />
        </View>
      </ScreenContainer>

      <LoadingOverlay visible={saving || locating} />
    </View>
  );
};

export default AttendanceWorkplaceSettingsScreen;
