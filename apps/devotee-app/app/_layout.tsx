import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hydrateQueryCache, persistQueryCache } from '@/api/persist';
import { createQueryClient, subscribeAppFocus } from '@/api/query-client';
import { ConfigGate } from '@/features/shell/ConfigGate';
import { ToastHost } from '@/features/shell/Toast';
import i18n from '@/lib/i18n';
import { colors } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// ConfigGate hides the splash once the remote config has settled.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The last server answers come back from disk first (offline cold start, T14).
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    hydrateQueryCache(client);
    return client;
  });
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => subscribeAppFocus(), []);
  useEffect(() => persistQueryCache(queryClient), [queryClient]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <ConfigGate>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
              />
            </ConfigGate>
            <ToastHost />
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
