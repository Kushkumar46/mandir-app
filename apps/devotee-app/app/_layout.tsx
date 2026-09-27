import '@/lib/i18n';

import { colors } from '@mandir/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Full provider stack (QueryClient, theme, audio, config/flags) arrives with Virtual Mandir T8.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
      />
    </GestureHandlerRootView>
  );
}
