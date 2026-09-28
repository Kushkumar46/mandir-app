import { MandirFlag, type OfferingKind } from '@mandir/shared-types';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AccessibilityActionEvent, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { CoinsNeededSheet } from '@/features/coins/CoinsNeededSheet';
import { useFlag } from '@/features/config/flags';
import { StatusView } from '@/features/shell/StatusView';
import { showToast } from '@/features/shell/Toast';
import { track } from '@/lib/analytics';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { useBellRinger } from '../hooks/useBells';
import { dismissGreetingGlow, useFirstVisitOfDay } from '../hooks/useFirstVisitOfDay';
import { useMandirHome, usePrefetchDeityImages } from '../hooks/useMandirHome';
import { feetSprites, useDeityOfferings, useOfferingFlow } from '../hooks/useOfferings';
import { coverRect, DEITY_IMAGE_ASPECT, mandirLayout, pickImageVariant, type Size } from '../layout';
import { coinsShort, displayTodayOfferings } from '../offerings';
import { adjacentIndex, swipeDirection } from '../sangrah';
import { useOfferingStore } from '../store/offerings';
import { useDeitySelectionStore } from '../store/selection';
import { Bells } from './Bells';
import { DeityScene } from './DeityScene';
import { OfferingEffects } from './offerings/OfferingEffects';
import { OfferingSheet } from './offerings/OfferingSheet';
import { AartiThaliButton, OfferingRail, OfflineBanner, type RailAction, SpecialActions, TithiStrip } from './SceneControls';
import { TodayDarshanGlow } from './TodayDarshanGlow';
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
  const ringBell = useBellRinger();
  // VM-01 first visit of the day: shankh + glow once the scene is on screen.
  const firstVisit = useFirstVisitOfDay(data?.today.localDate, focused && !!layout && !!deity);

  // VM-05 offerings (§3.2, §4.4)
  const offerings = useDeityOfferings(deity?.id);
  const { sheet, coinsNeeded, pendingItemId, active, lastOffered, openSheet, closeSheet, hideCoinsNeeded } = useOfferingStore();
  const { offer } = useOfferingFlow({ deityId: deity?.id, balance: data?.coins.balance, today: todayOfferings, offline });
  const shownToday =
    todayOfferings &&
    displayTodayOfferings(todayOfferings, active && active.deityId === deity?.id ? { kind: active.item.kind, before: active.before } : null);
  const sprites = offerings.data || (deity && lastOffered[deity.id]) ? feetSprites(offerings.data, deity ? lastOffered[deity.id] : undefined) : null;

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

  const openOfferings = (kind: OfferingKind) => {
    track('offering_sheet_opened', { kind });
    openSheet(kind);
  };
  const onRail = (action: RailAction) => {
    if (action === 'SANGRAH') openSangrah();
    else openOfferings(action);
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
                todayOfferings={shownToday}
                variant={variant}
                loading={loading}
                feetSprites={sprites}
              />
              </View>
            </GestureDetector>
            <OfferingEffects layout={layout} deity={deity} />
            {firstVisit && <TodayDarshanGlow layout={layout} onDone={dismissGreetingGlow} />}
            <TithiStrip layout={layout} text={data?.today.tithiText} />
            {offline && <OfflineBanner layout={layout} />}
            <Bells layout={layout} disabled={loading} onRing={ringBell} />
            <OfferingRail layout={layout} disabled={loading} offeringsEnabled={offeringsEnabled} onPress={onRail} />
            <AartiThaliButton layout={layout} thali={data?.thali} disabled={loading} onPress={comingSoon} />
            <SpecialActions layout={layout} deity={deity} disabled={loading} onSpecial={() => openOfferings('SPECIAL')} onListen={comingSoon} />
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
      {sheet && deity && (
        <OfferingSheet
          kind={sheet}
          query={offerings}
          balance={data?.coins.balance}
          pendingItemId={pendingItemId}
          onOffer={offer}
          onClose={closeSheet}
        />
      )}
      {coinsNeeded && (
        <CoinsNeededSheet short={coinsShort(coinsNeeded.required, coinsNeeded.balance)} balance={coinsNeeded.balance} onClose={hideCoinsNeeded} />
      )}
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
