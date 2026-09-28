import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App identity and endpoints come from env (docs/03-build-and-release.md §3):
 *   APP_NAME, APP_ID (Android package + iOS bundle id), API_URL, APP_ENV, DEV_USER.
 * EAS build profiles set APP_ENV; set the others as EAS env vars per environment.
 * Local dev reads `apps/devotee-app/.env.local` (gitignored; `pnpm dev:lan` writes API_URL with the
 * computer's LAN IP for a real phone). Without API_URL, local dev uses the Metro host IP on :4000
 * (src/lib/env.ts). Android emulator: API_URL=http://10.0.2.2:4000. Restart Metro after changing.
 * EAS project: @mandirapp/mandir-app (the id is not a secret; EAS_OWNER / EAS_PROJECT_ID override it).
 */
const APP_ENV = process.env.APP_ENV ?? 'local';
const APP_NAME = process.env.APP_NAME ?? 'Mandir';
// Placeholder — decide the real id before the first store build; never change it after release.
const APP_ID = process.env.APP_ID ?? 'com.mandirapp.devotee';
const API_URL = process.env.API_URL || undefined;
// DEV_AUTH stub user sent as X-Dev-User until the Auth module exists (never in production).
const DEV_USER = APP_ENV === 'production' ? undefined : (process.env.DEV_USER ?? 'dev-user');
const EAS_OWNER = process.env.EAS_OWNER ?? 'mandirapp';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'd0e29dfd-2a20-4a1a-b9a6-56029712975f';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'mandir-app',
  owner: EAS_OWNER,
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
    // Playback only: no microphone permission. Background playback is for aarti audio (T13).
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: true }],
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
    devUser: DEV_USER,
    eas: { projectId: EAS_PROJECT_ID },
  },
});
