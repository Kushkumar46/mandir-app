import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AARTI_MIN_CIRCLES, type HomeDeity, type HomeThali, MandirFlag } from '@mandir/shared-types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useFlag } from '@/features/config/flags';
import { BottomSheet } from '@/features/shell/BottomSheet';
import { showToast } from '@/features/shell/Toast';
import { track } from '@/lib/analytics';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { aartiLayout, formatClock, lyricIndex, lyricWindow } from '../../aarti';
import { pauseAarti, resumeAarti, stopAarti } from '../../aarti-player';
import type { BellSide } from '../../bells';
import { type CompletionState, useAartiSession } from '../../hooks/useAartiSession';
import { useThaliPicker } from '../../hooks/useThaliPicker';
import type { MandirLayout, Size } from '../../layout';
import { playShankh } from '../../sounds';
import { Bells } from '../Bells';
import { AartiThali } from './AartiThali';
import { ThaliPicker, UnlockThaliSheet } from './ThaliPicker';

type Props = {
  /** Height of the top bar: the overlay's header covers it. */
  sceneTop: number;
  /** The scene area (between the top bar and the bottom of the screen; the tab bar is hidden). */
  area: Size;
  layout: MandirLayout;
  deity: HomeDeity;
  thali: HomeThali | null;
  balance: number | undefined;
  onRing: (side: BellSide) => void;
  onClose: () => void;
};

/**
 * VM-06 Aarti mode (docs/modules/01-virtual-mandir.md §2 VM-06, §3.3, §4.3, §4.5): full-screen overlay
 * on VM-01 — aarti selector, audio with progress, synced lyrics, the circling thali (drag or Auto),
 * bells + shankh, the thali picker (`mandir.thali_designs`), close with confirmation, and the
 * "आरती सम्पन्न 🙏" overlay once the completion rule holds.
 */
export function AartiMode({ sceneTop, area, layout, deity, thali, balance, onRing, onClose }: Props) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const shareEnabled = useFlag(MandirFlag.SHARE_CARD);
  const s = useAartiSession(deity);
  const picker = useThaliPicker({ open: true, balance });
  const [confirmClose, setConfirmClose] = useState(false);
  const geometry = aartiLayout(area, layout.arch, deity.image?.anchor ?? null, picker.enabled);
  const finished = s.completion.status !== 'none';

  const leave = () => {
    if (!finished) track('aarti_abandoned', { playedRatio: Math.round(s.playedRatio * 100) / 100 });
    stopAarti();
    onClose();
  };
  const requestClose = () => (finished ? leave() : setConfirmClose(true));

  // Android back: close sheets first, then the same as X.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmClose || picker.unlocking) return false; // the sheet handles it
      if (finished) leave();
      else setConfirmClose(true);
      return true;
    });
    return () => sub.remove();
  });

  const deityName = pickLocalized(language, deity.nameHi, deity.nameEn);
  const aartiItems = s.aartis.data?.items ?? [];
  const { player } = s;
  const time = s.onThisAarti ? player.currentTime : 0;
  const duration = s.onThisAarti ? player.duration : (s.aarti?.durationSec ?? 0);

  return (
    <View style={StyleSheet.absoluteFill} testID="aarti-mode">
      {/* Header over the top bar */}
      <View style={[styles.header, { height: sceneTop }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mandir.aartiMode.close')}
            onPress={requestClose}
            style={styles.iconButton}
            hitSlop={4}
          >
            <MaterialCommunityIcons name="close" size={26} color={colors.cream} />
          </Pressable>
          <AppText variant="title" style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {s.aarti ? pickLocalized(language, s.aarti.titleHi, s.aarti.titleEn) : t('mandir.aartiMode.title', { name: deityName })}
          </AppText>
          {balance !== undefined && (
            <View style={styles.coins} accessibilityLabel={t('mandir.coins', { count: balance })}>
              <MaterialCommunityIcons name="circle-multiple" size={14} color={colors.maroon} />
              <AppText variant="caption" style={styles.coinsText}>
                {balance}
              </AppText>
            </View>
          )}
        </View>
        {aartiItems.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {aartiItems.map((a) => {
              const selected = a.id === s.aarti?.id;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => s.chooseAarti(a.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <AppText variant="caption" style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                    {pickLocalized(language, a.titleHi, a.titleEn)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Scene area */}
      <View style={[styles.scene, { top: sceneTop, width: area.width, height: area.height }]}>
        <View pointerEvents="none" style={styles.veil} />
        <AartiThali
          key={s.session}
          geometry={geometry}
          height={geometry.panel.y}
          thali={thali}
          auto={s.auto}
          autoPeriodMs={s.autoPeriodMs}
          onCircles={s.onManualCircles}
        />
        <Bells layout={layout} disabled={false} onRing={onRing} />

        <View style={[styles.panel, { top: geometry.panel.y, height: geometry.panel.height }]} testID="aarti-panel">
          {s.aartis.isPending ? (
            <ActivityIndicator color={colors.gold} style={styles.status} accessibilityLabel={t('mandir.aartiMode.loading')} />
          ) : s.aartis.isError && !s.aartis.data ? (
            <View style={styles.status}>
              <AppText style={styles.statusText}>{t('mandir.aartiMode.loadFailed')}</AppText>
              <Pressable accessibilityRole="button" onPress={() => void s.aartis.refetch()} style={styles.retry}>
                <AppText variant="button">{t('common.retry')}</AppText>
              </Pressable>
            </View>
          ) : !s.aarti ? (
            <AppText style={[styles.status, styles.statusText]}>{t('mandir.aartiMode.none')}</AppText>
          ) : (
            <>
              <Lyrics lyrics={s.lyrics} time={time} />
              <View style={styles.progressRow}>
                <AppText variant="caption" style={styles.clock}>
                  {formatClock(time)}
                </AppText>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${duration > 0 ? Math.min(100, (time / duration) * 100) : 0}%` }]} />
                </View>
                <AppText variant="caption" style={styles.clock}>
                  {formatClock(duration)}
                </AppText>
              </View>
              <View style={styles.controls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={player.playing ? t('mandir.aartiMode.pause') : t('mandir.aartiMode.play')}
                  onPress={() => (player.playing ? pauseAarti() : resumeAarti())}
                  style={styles.play}
                  testID="aarti-play"
                >
                  {player.waiting && player.playing ? (
                    <ActivityIndicator color={colors.maroon} />
                  ) : (
                    <MaterialCommunityIcons name={player.playing ? 'pause' : 'play'} size={30} color={colors.maroon} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={t('mandir.aartiMode.autoA11y')}
                  accessibilityState={{ checked: s.auto }}
                  onPress={() => s.setAuto(!s.auto)}
                  style={[styles.pill, s.auto && styles.pillOn]}
                >
                  <MaterialCommunityIcons name="rotate-right" size={18} color={s.auto ? colors.maroon : colors.cream} />
                  <AppText variant="caption" style={[styles.pillText, s.auto && styles.pillTextOn]}>
                    {t('mandir.aartiMode.auto')}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mandir.aartiMode.shankh')}
                  onPress={playShankh}
                  style={styles.iconButton}
                >
                  <MaterialCommunityIcons name="trumpet" size={24} color={colors.cream} />
                </Pressable>
                <View
                  style={[styles.pill, s.circles >= AARTI_MIN_CIRCLES && styles.pillDone]}
                  accessibilityLabel={t('mandir.aartiMode.circles', { count: Math.min(s.circles, AARTI_MIN_CIRCLES), min: AARTI_MIN_CIRCLES })}
                  testID="aarti-circles"
                >
                  <MaterialCommunityIcons
                    name={s.circles >= AARTI_MIN_CIRCLES ? 'check-circle' : 'sync'}
                    size={16}
                    color={colors.cream}
                  />
                  <AppText variant="caption" style={styles.pillText}>
                    {t('mandir.aartiMode.circles', { count: Math.min(s.circles, AARTI_MIN_CIRCLES), min: AARTI_MIN_CIRCLES })}
                  </AppText>
                </View>
              </View>
            </>
          )}
          {picker.enabled && <ThaliPicker items={picker.items} loading={picker.loading} onPick={picker.onPick} />}
        </View>

        {finished && (
          <CompletionCard
            completion={s.completion}
            shareEnabled={shareEnabled}
            onRetry={s.retry}
            onShare={() => showToast(t('mandir.comingSoon'))} // VM-12 share card (T19)
            onClose={leave}
          />
        )}
      </View>

      {picker.unlocking && (
        <UnlockThaliSheet
          thali={picker.unlocking}
          balance={balance}
          pending={picker.unlockPending}
          onConfirm={picker.confirmUnlock}
          onClose={picker.cancelUnlock}
        />
      )}
      {confirmClose && (
        <BottomSheet title={t('mandir.aartiMode.confirmTitle')} onClose={() => setConfirmClose(false)} testID="aarti-confirm-close">
          <View style={styles.sheet}>
            <AppText style={styles.sheetText}>{t('mandir.aartiMode.confirmBody')}</AppText>
            <Pressable accessibilityRole="button" onPress={() => setConfirmClose(false)} style={[styles.sheetButton, styles.sheetPrimary]}>
              <AppText variant="button" style={styles.sheetPrimaryText}>
                {t('mandir.aartiMode.continue')}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={leave} style={styles.sheetButton}>
              <AppText variant="button" style={styles.sheetSecondaryText}>
                {t('mandir.aartiMode.leave')}
              </AppText>
            </Pressable>
          </View>
        </BottomSheet>
      )}
    </View>
  );
}

/** §4.5 lyrics: 3 visible lines, the current one highlighted, the window moves with the audio. */
function Lyrics({ lyrics, time }: { lyrics: { t: number; line: string }[] | undefined; time: number }) {
  if (!lyrics?.length) return <View style={styles.lyrics} />;
  const { start, lines, current } = lyricWindow(lyrics, lyricIndex(lyrics, time));
  return (
    <Animated.View key={start} entering={FadeIn.duration(250)} style={styles.lyrics} testID="aarti-lyrics">
      {lines.map((l, i) => (
        <AppText
          key={start + i}
          variant={i === current ? 'bodyLarge' : 'body'}
          style={[styles.lyric, i === current && styles.lyricCurrent]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          testID={i === current ? 'aarti-lyric-current' : undefined}
        >
          {l.line}
        </AppText>
      ))}
    </Animated.View>
  );
}

function CompletionCard({
  completion,
  shareEnabled,
  onRetry,
  onShare,
  onClose,
}: {
  completion: CompletionState;
  shareEnabled: boolean;
  onRetry: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.doneBackdrop}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.done} testID="aarti-complete" accessibilityViewIsModal>
        <AppText variant="heading" style={styles.doneTitle} accessibilityRole="header">
          {t('mandir.aartiMode.done')}
        </AppText>
        {completion.status === 'sending' && (
          <View style={styles.doneRow}>
            <ActivityIndicator color={colors.maroon} />
            <AppText style={styles.doneText}>{t('mandir.aartiMode.saving')}</AppText>
          </View>
        )}
        {completion.status === 'done' && (
          <AppText variant="bodyLarge" style={styles.doneText}>
            {t('mandir.aartiMode.streak', { count: completion.res.streak.current })}
          </AppText>
        )}
        {completion.status === 'failed' && (
          <>
            <AppText style={styles.doneText}>{completion.message}</AppText>
            <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.sheetButton, styles.sheetPrimary]}>
              <AppText variant="button" style={styles.sheetPrimaryText}>
                {t('common.retry')}
              </AppText>
            </Pressable>
          </>
        )}
        {shareEnabled && completion.status === 'done' && (
          <Pressable accessibilityRole="button" onPress={onShare} style={[styles.sheetButton, styles.sheetPrimary]}>
            <MaterialCommunityIcons name="share-variant" size={18} color={colors.white} />
            <AppText variant="button" style={styles.sheetPrimaryText}>
              {t('mandir.aartiMode.share')}
            </AppText>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetButton}>
          <AppText variant="button" style={styles.sheetSecondaryText}>
            {t('common.close')}
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const panelBg = 'rgba(43, 20, 12, 0.88)';

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.maroon,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, gap: spacing.xs },
  headerTitle: { flex: 1, color: colors.cream },
  iconButton: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
  },
  coinsText: { color: colors.maroon },
  chips: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingTop: 2 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    maxWidth: 220,
  },
  chipSelected: { backgroundColor: colors.gold },
  chipText: { color: colors.cream },
  chipTextSelected: { color: colors.maroon },
  scene: { position: 'absolute', left: 0, overflow: 'hidden' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 8, 4, 0.18)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: panelBg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1.5,
    borderColor: colors.gold,
    paddingTop: spacing.sm,
  },
  status: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  statusText: { color: colors.cream, textAlign: 'center' },
  retry: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyrics: { height: 78, justifyContent: 'center', paddingHorizontal: spacing.md },
  lyric: { color: 'rgba(255, 246, 229, 0.6)', textAlign: 'center', lineHeight: 24 },
  lyricCurrent: { color: colors.gold, lineHeight: 28 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 20 },
  clock: { color: colors.cream, fontSize: 11, lineHeight: 16, minWidth: 32, textAlign: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 246, 229, 0.25)', overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: colors.gold },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 52,
    paddingHorizontal: spacing.sm,
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  pillOn: { backgroundColor: colors.gold },
  pillDone: { backgroundColor: 'rgba(76, 140, 60, 0.85)', borderColor: 'rgba(76, 140, 60, 0.85)' },
  pillText: { color: colors.cream, fontSize: 12, lineHeight: 18 },
  pillTextOn: { color: colors.maroon },
  doneBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 8, 4, 0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  done: {
    alignSelf: 'stretch',
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  doneTitle: { color: colors.maroon, textAlign: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneText: { color: colors.maroon, textAlign: 'center' },
  sheet: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetText: { color: colors.maroon, textAlign: 'center' },
  sheetButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimary: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  sheetPrimaryText: { color: colors.white },
  sheetSecondaryText: { color: colors.maroon },
});
