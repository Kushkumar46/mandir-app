import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App identity and endpoints come from env (docs/03-build-and-release.md §3):
 *   APP_NAME, APP_ID (Android package + iOS bundle id), API_URL, APP_ENV.
 * EAS build profiles set APP_ENV; set the others as EAS env vars per environment.
 * Local Android emulator: API_URL=http://10.0.2.2:4000 (localhost is the emulator itself).
 */
const APP_ENV = process.env.APP_ENV ?? 'local';
const APP_NAME = process.env.APP_NAME ?? 'Mandir';
// Placeholder — decide the real id before the first store build; never change it after release.
const APP_ID = process.env.APP_ID ?? 'com.mandirapp.devotee';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'mandir-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mandir',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      backgroundColor: '#FFF6E5',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFF6E5',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv: APP_ENV,
    apiUrl: API_URL,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
