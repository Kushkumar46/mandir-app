import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { AppText, colors, radius, spacing } from '@/theme';

const TOAST_MS = 2500;

type ToastState = {
  toast: { id: number; message: string } | null;
  show: (message: string) => void;
  hide: (id: number) => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  show: (message) => set({ toast: { id: (get().toast?.id ?? 0) + 1, message } }),
  hide: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
}));

/** Short message above the tab bar, e.g. "इंटरनेट से जुड़ें" (VM-01 offline state). Pass translated text. */
export function showToast(message: string) {
  useToastStore.getState().show(message);
}

/** Mounted once in the root layout. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 72 }]}>
      {toast && (
        <Animated.View key={toast.id} entering={FadeInDown.duration(200)} exiting={FadeOut.duration(200)} style={styles.toast}>
          <AppText variant="body" style={styles.text} accessibilityLiveRegion="polite" accessibilityRole="alert">
            {toast.message}
          </AppText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: {
    backgroundColor: 'rgba(43, 26, 16, 0.92)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxWidth: 420,
  },
  text: { color: colors.white, textAlign: 'center' },
});
