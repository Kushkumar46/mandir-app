import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';

import { useAppConfigQuery } from '@/api/config';
import { effectiveConfig } from '@/features/config/flags';

import { ForceUpdateScreen } from './ForceUpdateScreen';
import { StatusView } from './StatusView';

/**
 * Loads `GET /v1/config` before the app renders (flags decide which tabs exist), keeps the splash
 * up until then, and blocks the app behind the force-update screen when required.
 * Later refetches (foreground, 30 min stale) keep showing the previous config; the last config is
 * also restored from disk at launch (T14). Without internet and without a saved config the app opens
 * with the offline fallback config (fallback mandir) and picks up the real one on the next refetch.
 */
export function ConfigGate({ children }: { children: ReactNode }) {
  const config = useAppConfigQuery();

  useEffect(() => {
    if (!config.isPending) void SplashScreen.hideAsync();
  }, [config.isPending]);

  if (config.isPending) return null;
  const effective = effectiveConfig(config.data, config.error);
  if (!effective) return <StatusView state="error" error={config.error} onRetry={() => void config.refetch()} />;
  if (effective.forceUpdate) return <ForceUpdateScreen />;
  return children;
}
