import React, {useEffect, useMemo, useRef} from 'react';
import {Platform, StyleSheet, View, type ViewStyle} from 'react-native';
import WebView, {type WebViewMessageEvent} from 'react-native-webview';
import {useTheme} from '@app/context/ThemeContext';
import {
  buildAttendanceWorkplacePickerMapHtml,
  buildAttendanceWorkplacePickerUpdateScript,
} from '@app/utils/buildAttendanceWorkplacePickerMapHtml';

interface Props {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  style?: ViewStyle;
}

const AttendanceWorkplaceMapPicker: React.FC<Props> = ({
  latitude,
  longitude,
  radiusMeters,
  onLocationChange,
  style,
}) => {
  const {theme} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const mapReady = useRef(false);

  const mapHtml = useMemo(
    () =>
      buildAttendanceWorkplacePickerMapHtml({
        latitude,
        longitude,
        radiusMeters,
        markerColor: theme.colors.primary,
        circleColor: theme.colors.primary,
      }),
    [theme.colors.primary],
  );

  const pushMapState = (recenter: boolean) => {
    webViewRef.current?.injectJavaScript(
      buildAttendanceWorkplacePickerUpdateScript(latitude, longitude, radiusMeters, recenter),
    );
  };

  useEffect(() => {
    if (!mapReady.current) {
      return;
    }
    pushMapState(false);
  }, [latitude, longitude, radiusMeters]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        latitude?: number;
        longitude?: number;
      };
      if (
        payload.type === 'location' &&
        Number.isFinite(payload.latitude) &&
        Number.isFinite(payload.longitude)
      ) {
        onLocationChange(payload.latitude as number, payload.longitude as number);
      }
    } catch {
      // Ignore malformed map messages.
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: '#e5e3df',
          overflow: 'hidden',
        },
        map: {
          width: '100%',
          backgroundColor: 'transparent',
        },
      }),
    [theme],
  );

  const flatStyle = StyleSheet.flatten(style);
  const mapHeight = typeof flatStyle?.height === 'number' ? flatStyle.height : 220;

  return (
    <View style={[styles.wrap, style]} collapsable={false}>
      <WebView
        ref={webViewRef}
        style={[styles.map, {height: mapHeight}]}
        originWhitelist={['*']}
        source={{html: mapHtml}}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        onMessage={handleMessage}
        onLoadEnd={() => {
          mapReady.current = true;
          pushMapState(true);
        }}
      />
    </View>
  );
};

export default AttendanceWorkplaceMapPicker;
