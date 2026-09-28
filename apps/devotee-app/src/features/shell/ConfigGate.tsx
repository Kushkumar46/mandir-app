import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';

import { useAppConfigQuery } from '@/api/config';

import { ForceUpdateScreen } from './ForceUpdateScreen';
import { StatusView } from './StatusView';

/**
 * Loads `GET /v1/config` before the app renders (flags decide which tabs exist), keeps the splash
 * up until then, and blocks the app behind the force-update screen when required.
 * Later refetches (foreground, 30 min stale) keep showing the previous config.
 */
export function ConfigGate({ children }: { children: ReactNode }) {
  const config = useAppConfigQuery();

  useEffect(() => {
    if (!config.isPending) void SplashScreen.hideAsync();
  }, [config.isPending]);

  if (config.isPending) return null;
  if (!config.data) return <StatusView state="error" error={config.error} onRetry={() => void config.refetch()} />;
  if (config.data.forceUpdate) return <ForceUpdateScreen />;
  return children;
}
