import type {ExpoConfig} from 'expo/config';

const appJson = require('./app.json');

export default (): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  const plugins = [...(base.plugins ?? [])];
  if (!plugins.some((entry) => entry === 'expo-splash-screen' || (Array.isArray(entry) && entry[0] === 'expo-splash-screen'))) {
    plugins.push([
      'expo-splash-screen',
      {
        backgroundColor: '#F8FAFC',
      },
    ]);
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
