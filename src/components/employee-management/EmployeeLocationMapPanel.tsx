import React, {useEffect, useMemo, useRef} from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import WebView from 'react-native-webview';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {getAttendanceWorkplace, getAttendanceWorkplaceMapsUrl} from '@app/utils/attendanceWorkplace';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {EmployeeLastLocation} from '@app/types/models';
import {
  buildEmployeeLocationMapHtml,
  buildEmployeeLocationMapMarkerScript,
} from '@app/utils/buildEmployeeLocationMapHtml';
import {
  buildEmployeeLocationMapsUrl,
  formatEmployeeLocationUpdatedAt,
  isEmployeeLocationStale,
} from '@app/utils/employeeLocationDisplay';

interface Props {
  employeeName: string;
  location: EmployeeLastLocation | undefined;
}

const EmployeeLocationMapPanel: React.FC<Props> = ({employeeName, location}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const webViewRef = useRef<WebView>(null);

  const workplace = getAttendanceWorkplace();
  const centerLatitude = location?.latitude ?? workplace.latitude;
  const centerLongitude = location?.longitude ?? workplace.longitude;
  const hasFreshLocation = Boolean(location) && !isEmployeeLocationStale(location);

  const mapHtml = useMemo(
    () =>
      buildEmployeeLocationMapHtml({
        centerLatitude,
        centerLongitude,
        workplace: {
          name: workplace.name,
          latitude: workplace.latitude,
          longitude: workplace.longitude,
          color: theme.colors.primary,
        },
        employee: location
          ? {
              name: employeeName,
              latitude: location.latitude,
              longitude: location.longitude,
              color: '#E53935',
            }
          : undefined,
      }),
    [
      centerLatitude,
      centerLongitude,
      employeeName,
      location,
      theme.colors.primary,
      workplace.latitude,
      workplace.longitude,
      workplace.name,
    ],
  );

  useEffect(() => {
    if (!webViewRef.current) {
      return;
    }

    const script = buildEmployeeLocationMapMarkerScript(
      {
        name: workplace.name,
        latitude: workplace.latitude,
        longitude: workplace.longitude,
        color: theme.colors.primary,
      },
      location
        ? {
            name: employeeName,
            latitude: location.latitude,
            longitude: location.longitude,
            color: '#E53935',
          }
        : undefined,
      centerLatitude,
      centerLongitude,
    );

    webViewRef.current.injectJavaScript(script);
  }, [centerLatitude, centerLongitude, employeeName, location, theme.colors.primary, workplace]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, gap: 12},
        mapWrap: {
          flex: 1,
          minHeight: 320,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: '#e5e3df',
        },
        map: {flex: 1, backgroundColor: 'transparent'},
        infoCard: {
          padding: 14,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          gap: 8,
        },
        infoRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: 8,
        },
        infoText: {flex: 1, fontSize: 14, lineHeight: 20},
        actions: {flexDirection: row, gap: 10},
        actionBtn: {
          flex: 1,
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.primary,
        },
        actionBtnSecondary: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        actionText: {fontSize: 14, fontWeight: '600', color: theme.colors.onPrimary},
        actionTextSecondary: {color: theme.typography.primary},
        emptyText: {fontSize: 14, lineHeight: 20},
      }),
    [row, theme],
  );

  const recenterMap = () => {
    webViewRef.current?.injectJavaScript(
      `window.recenterMap && window.recenterMap(${centerLatitude}, ${centerLongitude}, 15); true;`,
    );
  };

  const openInMaps = () => {
    if (!location) {
      Linking.openURL(getAttendanceWorkplaceMapsUrl(workplace)).catch(() => undefined);
      return;
    }

    Linking.openURL(buildEmployeeLocationMapsUrl(location.latitude, location.longitude)).catch(
      () => undefined,
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.infoCard, layoutStyle]}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-radius" size={20} color={theme.colors.primary} />
          <Text style={[styles.infoText, textStyle, {color: theme.typography.primary}]}>
            {employeeName}
          </Text>
        </View>
        <Text style={[styles.infoText, textStyle, {color: theme.typography.secondary}]}>
          {formatEmployeeLocationUpdatedAt(location, t)}
        </Text>
        {location ? (
          <Text style={[styles.infoText, textStyle, {color: theme.typography.secondary}]}>
            {t('employeeLocationCoordinates', {
              lat: location.latitude.toFixed(5),
              lng: location.longitude.toFixed(5),
            })}
          </Text>
        ) : null}
        {!hasFreshLocation ? (
          <Text style={[styles.emptyText, textStyle, {color: theme.typography.secondary}]}>
            {t('employeeLocationMapEmptyHint')}
          </Text>
        ) : null}
      </View>

      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{html: mapHtml}}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnSecondary, layoutStyle]}
          onPress={recenterMap}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={18}
            color={theme.typography.primary}
          />
          <Text style={[styles.actionText, styles.actionTextSecondary, textStyle]}>
            {t('employeeLocationRecenter')}
          </Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, layoutStyle]} onPress={openInMaps}>
          <MaterialCommunityIcons name="google-maps" size={18} color={theme.colors.onPrimary} />
          <Text style={[styles.actionText, textStyle]}>{t('employeeLocationOpenInMaps')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default EmployeeLocationMapPanel;
