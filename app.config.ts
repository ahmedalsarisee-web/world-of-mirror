import type {ExpoConfig} from 'expo/config';
import {ConfigPlugin, withAndroidManifest, withAndroidStyles} from 'expo/config-plugins';

const appJson = require('./app.json');

const SPLASH_BACKGROUND = '#F8FAFC';
const SPLASH_STYLE_NAME = 'Theme.App.SplashScreen';

const WHATSAPP_MAIN_ANDROID_PACKAGE = 'com.whatsapp';

const withWhatsAppPackageQuery: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const mainManifest = mod.modResults.manifest;
    if (!mainManifest.queries) {
      mainManifest.queries = [];
    }

    const queries = mainManifest.queries;
    const existingPackages = new Set<string>();

    for (const query of queries) {
      if (!query.package) {
        continue;
      }
      const packages = Array.isArray(query.package) ? query.package : [query.package];
      for (const pkg of packages) {
        const name = pkg.$?.['android:name'];
        if (name) {
          existingPackages.add(name);
        }
      }
    }

    if (existingPackages.has(WHATSAPP_MAIN_ANDROID_PACKAGE)) {
      return mod;
    }

    const packageEntry = {$: {'android:name': WHATSAPP_MAIN_ANDROID_PACKAGE}};
    if (queries.length === 0) {
      queries.push({package: [packageEntry]});
      return mod;
    }

    const firstQuery = queries[0];
    const packages = firstQuery.package
      ? Array.isArray(firstQuery.package)
        ? firstQuery.package
        : [firstQuery.package]
      : [];
    firstQuery.package = [...packages, packageEntry];
    return mod;
  });

/** Android 12+: solid background only, no animated splash icon. */
const withSolidSplashOnly: ConfigPlugin = (config) =>
  withAndroidStyles(config, (mod) => {
    const styles = mod.modResults;
    const styleList = styles.resources.style;
    if (!styleList) {
      return mod;
    }

    for (const style of styleList) {
      if (style.$?.name !== SPLASH_STYLE_NAME) {
        continue;
      }

      const items = Array.isArray(style.item) ? style.item : style.item ? [style.item] : [];
      style.item = items.filter(
        (item) =>
          item.$?.name !== 'windowSplashScreenAnimatedIcon' &&
          item.$?.name !== 'android:windowSplashScreenBehavior',
      );
    }

    return mod;
  });

export default (): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const plugins = [...(base.plugins ?? [])];
  if (!plugins.some((entry) => entry === 'expo-splash-screen' || (Array.isArray(entry) && entry[0] === 'expo-splash-screen'))) {
    plugins.push([
      'expo-splash-screen',
      {
        backgroundColor: SPLASH_BACKGROUND,
        android: {
          backgroundColor: SPLASH_BACKGROUND,
        },
        ios: {
          backgroundColor: SPLASH_BACKGROUND,
        },
      },
    ]);
  }

  if (!plugins.includes(withSolidSplashOnly)) {
    plugins.push(withSolidSplashOnly);
  }
  if (!plugins.some((entry) => entry === 'react-native-image-marker' || (Array.isArray(entry) && entry[0] === 'react-native-image-marker'))) {
    plugins.push('react-native-image-marker');
  }
  if (!plugins.includes(withWhatsAppPackageQuery)) {
    plugins.push(withWhatsAppPackageQuery);
  }

  return {
    ...base,
    plugins,
    extra: {
      ...base.extra,
      eas: {
        ...(typeof base.extra === 'object' && base.extra && 'eas' in base.extra
          ? (base.extra as {eas?: Record<string, unknown>}).eas
          : {}),
        ...(easProjectId ? {projectId: easProjectId} : {}),
      },
    },
  };
};
