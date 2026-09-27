import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; appEnv?: string };

export const env = {
  apiUrl: extra.apiUrl ?? 'http://localhost:4000',
  appEnv: extra.appEnv ?? 'local',
} as const;
