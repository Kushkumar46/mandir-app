import { MandirFlag } from '@mandir/shared-types';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AccessibilityActionEvent, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useFlag } from '@/features/config/flags';
import { StatusView } from '@/features/shell/StatusView';
import { showToast } from '@/features/shell/Toast';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { useMandirHome, usePrefetchDeityImages } from '../hooks/useMandirHome';
import { coverRect, DEITY_IMAGE_ASPECT, mandirLayout, pickImageVariant, type Size } from '../layout';
import { adjacentIndex, swipeDirection } from '../sangrah';
import { useDeitySelectionStore } from '../store/selection';
import { DeityScene } from './DeityScene';
import { AartiThaliButton, Bells, OfferingRail, OfflineBanner, type RailAction, SpecialActions, TithiStrip } from './SceneControls';
import { TopBar } from './TopBar';

/**
 * VM-01 Mandir Home (docs/modules/01-virtual-mandir.md §2): top bar, garbhagriha, tithi strip,
 * offering rail, thali + special offering, feet area. Loading shows the same layout with a shimmer
 * and disabled controls; a failed refresh keeps the last scene and shows the offline banner.
 */
export function MandirHome() {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const offeringsEnabled = useFlag(MandirFlag.OFFERINGS);
  const { enabled, home, data, deity, todayOfferings, offline } = useMandirHome();
  const select = useDeitySelectionStore((s) => s.select);
  const [area, setArea] = useState<Size | null>(null);
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const layout = area ? mandirLayout(area) : null;
  // Width the deity image is drawn at (it covers the arch), in physical pixels → variant (§4.6).
  const variant = pickImageVariant(
    layout ? PixelRatio.getPixelSizeForLayoutSize(coverRect(layout.arch, DEITY_IMAGE_ASPECT).width) : 0,
  );
  usePrefetchDeityImages((layout && data?.deities.map((d) => d.image?.urls)) || [], variant);

  if (!enabled) return <StatusView state="message" message={t('mandir.disabled')} />;
  if (!data && home.isError) return <StatusView state="error" error={home.error} onRetry={() => void home.refetch()} />;

  const loading = !data;
  const deityName = deity ? pickLocalized(language, deity.nameHi, deity.nameEn) : undefined;
  const comingSoon = () => showToast(t('mandir.comingSoon'));
  const openSangrah = () => router.push('/sangrah');
  const deities = data?.deities ?? [];

  // VM-02: next/previous deity (swipe on the garbhagriha, or the screen reader's adjust actions).
  const switchBy = (direction: 1 | -1) => {
    const next = deities[adjacentIndex(deities.findIndex((d) => d.id === deity?.id), deities.length, direction)];
    if (next && next.id !== deity?.id) select(next.id);
  };
  const sceneGesture = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      .enabled(deities.length > 1)
      .withTestId('mandir-swipe')
      .activeOffsetX([-24, 24])
      .failOffsetY([-20, 20])
      .onEnd((e) => {
        const direction = swipeDirection(e.translationX, e.velocityX);
        if (direction) switchBy(direction);
      }),
    // VM-04 darshan chooser (T18)
    Gesture.LongPress().runOnJS(true).enabled(!loading).minDuration(500).onStart(comingSoon),
  );
  const onSceneAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') switchBy(1);
    if (e.nativeEvent.actionName === 'decrement') switchBy(-1);
  };

  const onRail = (action: RailAction) => {
    if (action === 'SANGRAH') openSangrah();
    else comingSoon(); // VM-05 offering sheet (T12)
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== area?.width || height !== area?.height) setArea({ width, height });
  };

  return (
    <View style={styles.screen}>
      {focused && <StatusBar style="light" />}
      <TopBar
        weekday={data?.today.weekday}
        coins={data?.coins.balance}
        deities={data?.deities}
        selectedId={deity?.id}
        onProfile={() => router.navigate('/profile')}
        onCoins={comingSoon} // VM-07 coins (T15)
        onSelectDeity={select}
        onAddDeity={openSangrah}
      />
      <View style={styles.scene} onLayout={onLayout} testID="mandir-scene">
        {layout && (
          <>
            <GestureDetector gesture={sceneGesture}>
              <View
                style={StyleSheet.absoluteFill}
                accessible={!!deityName}
                accessibilityRole="adjustable"
                accessibilityLabel={deityName ? t('mandir.sceneA11y', { name: deityName }) : undefined}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={onSceneAction}
                testID="mandir-garbhagriha"
              >
              <DeityScene
                layout={layout}
                theme={data?.theme ?? null}
                deity={deity}
                todayOfferings={todayOfferings}
                variant={variant}
                loading={loading}
              />
              </View>
            </GestureDetector>
            <TithiStrip layout={layout} text={data?.today.tithiText} />
            {offline && <OfflineBanner layout={layout} />}
            <Bells layout={layout} disabled={loading} />
            <OfferingRail layout={layout} disabled={loading} offeringsEnabled={offeringsEnabled} onPress={onRail} />
            <AartiThaliButton layout={layout} thali={data?.thali} disabled={loading} onPress={comingSoon} />
            <SpecialActions layout={layout} deity={deity} disabled={loading} onSpecial={comingSoon} onListen={comingSoon} />
            {data && !deity && (
              <View style={styles.empty}>
                <AppText variant="bodyLarge" style={styles.emptyText}>
                  {t('mandir.emptyMandir')}
                </AppText>
                <Pressable accessibilityRole="button" onPress={openSangrah} style={styles.emptyButton}>
                  <AppText variant="button">{t('mandir.openSangrah')}</AppText>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.maroon },
  scene: { flex: 1, overflow: 'hidden' },
  empty: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyText: { color: colors.cream, textAlign: 'center' },
  emptyButton: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
