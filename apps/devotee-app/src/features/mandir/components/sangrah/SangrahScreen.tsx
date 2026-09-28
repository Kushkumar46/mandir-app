import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { DeityListItem } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AccessibilityActionEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeitiesQuery, useMandirHomeQuery, useSetMandirDeitiesMutation } from '@/api/mandir';
import { StatusView } from '@/features/shell/StatusView';
import { showToast } from '@/features/shell/Toast';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { FALLBACK_DEITY_IMAGE } from '../../assets';
import {
  moveItem,
  SANGRAH_MAX,
  type SangrahEntry,
  sangrahFromHome,
  toggleDeity,
  togglePin,
  toSetDeitiesRequest,
} from '../../sangrah';
import { ReorderableList } from './ReorderableList';

const ROW_HEIGHT = 72;
const GRID_COLUMNS = 3;
const GRID_GAP = 12;

/** VM-03 Sangrah: the user's deities (order, pin, remove) and all active deities (add/remove). */
export function SangrahScreen() {
  const home = useMandirHomeQuery();
  const deities = useDeitiesQuery();

  let body;
  if (home.isPending || deities.isPending) body = <StatusView state="loading" />;
  else if (!home.data || !deities.data) {
    body = (
      <StatusView
        state="error"
        error={home.error ?? deities.error}
        onRetry={() => void Promise.all([home.refetch(), deities.refetch()])}
      />
    );
  } else body = <SangrahEditor initial={sangrahFromHome(home.data)} deities={deities.data} />;

  return <View style={styles.screen}>{body}</View>;
}

type Tab = 'mine' | 'all';

/** Holds the edited list; every change is saved at once (`PUT /mandir/deities`, serialised). */
function SangrahEditor({ initial, deities }: { initial: SangrahEntry[]; deities: DeityListItem[] }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(initial);
  const [tab, setTab] = useState<Tab>('mine');
  const [dragging, setDragging] = useState(false);
  const save = useSetMandirDeitiesMutation();
  const byId = new Map(deities.map((d) => [d.id, d]));

  const commit = (next: SangrahEntry[]) => {
    setList(next);
    save.mutate(toSetDeitiesRequest(next));
  };
  const onToggle = (deityId: string) => {
    const result = toggleDeity(list, deityId);
    if (result.error === 'MIN_DEITIES') showToast(t('sangrah.minReached'));
    else if (result.error === 'MAX_DEITIES') showToast(t('sangrah.maxReached', { max: SANGRAH_MAX }));
    else commit(result.list);
  };
  const onReorder = (ids: string[]) =>
    commit(ids.flatMap((id) => list.filter((e) => e.deityId === id)));

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color={colors.cream} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>
          {t('sangrah.title')}
        </AppText>
        <View style={styles.countPill}>
          <AppText variant="caption" style={styles.countText}>
            {t('sangrah.count', { count: list.length, max: SANGRAH_MAX })}
          </AppText>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['mine', 'all'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabSelected]}
          >
            <AppText variant="button" style={{ color: tab === key ? colors.white : colors.maroon }}>
              {t(key === 'mine' ? 'sangrah.myMandir' : 'sangrah.allDeities')}
            </AppText>
          </Pressable>
        ))}
      </View>

      <SaveStatus
        pending={save.isPending}
        failed={save.isError}
        saved={save.isSuccess}
        onRetry={() => save.mutate(toSetDeitiesRequest(list))}
      />

      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {tab === 'mine' ? (
          <>
            <AppText variant="caption" style={styles.hint}>
              {t('sangrah.dragHint')}
            </AppText>
            <ReorderableList
              ids={list.map((e) => e.deityId)}
              rowHeight={ROW_HEIGHT}
              onReorder={onReorder}
              onDragChange={setDragging}
              renderRow={(id, index) => (
                <MyDeityRow
                  deity={byId.get(id)}
                  entry={list[index]!}
                  canMoveUp={index > 0}
                  canMoveDown={index < list.length - 1}
                  onMove={(direction) => commit(moveItem(list, index, index + direction))}
                  onPin={() => commit(togglePin(list, id))}
                  onRemove={() => onToggle(id)}
                />
              )}
            />
          </>
        ) : (
          <DeityGrid deities={deities} selected={new Set(list.map((e) => e.deityId))} onToggle={onToggle} />
        )}
      </ScrollView>
    </>
  );
}

function SaveStatus({ pending, failed, saved, onRetry }: { pending: boolean; failed: boolean; saved: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  if (!pending && !failed && !saved) return <View style={styles.status} />;
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {pending ? (
        <AppText variant="caption">{t('sangrah.saving')}</AppText>
      ) : failed ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
          <AppText variant="caption" style={{ color: colors.danger }}>
            {t('sangrah.saveFailed')} · {t('common.retry')}
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.retry}>
          <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
          <AppText variant="caption" style={{ color: colors.success }}>
            {t('sangrah.saved')}
          </AppText>
        </View>
      )}
    </View>
  );
}

type RowProps = {
  deity: DeityListItem | undefined;
  entry: SangrahEntry;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: 1 | -1) => void;
  onPin: () => void;
  onRemove: () => void;
};

function MyDeityRow({ deity, entry, canMoveUp, canMoveDown, onMove, onPin, onRemove }: RowProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const name = deity ? pickLocalized(language, deity.nameHi, deity.nameEn) : '';
  const actions = [
    ...(canMoveUp ? [{ name: 'moveUp', label: t('sangrah.moveUp') }] : []),
    ...(canMoveDown ? [{ name: 'moveDown', label: t('sangrah.moveDown') }] : []),
  ];
  const onAction = (e: AccessibilityActionEvent) => onMove(e.nativeEvent.actionName === 'moveUp' ? -1 : 1);

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="drag-vertical" size={24} color={colors.textMuted} />
      <Image
        source={deity?.image ? { uri: deity.image.urls.thumb } : FALLBACK_DEITY_IMAGE}
        style={styles.rowImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View
        style={styles.rowName}
        accessible
        accessibilityLabel={name}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}
      >
        <AppText variant="bodyLarge" numberOfLines={1}>
          {name}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(entry.isPinned ? 'sangrah.unpin' : 'sangrah.pin')}
        accessibilityState={{ selected: entry.isPinned }}
        onPress={onPin}
        style={styles.iconButton}
      >
        <MaterialCommunityIcons name={entry.isPinned ? 'star' : 'star-outline'} size={28} color={colors.gold} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sangrah.remove')} onPress={onRemove} style={styles.iconButton}>
        <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function DeityGrid({
  deities,
  selected,
  onToggle,
}: {
  deities: DeityListItem[];
  selected: Set<string>;
  onToggle: (deityId: string) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - 2 * spacing.md - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS);

  return (
    <View style={styles.grid}>
      {deities.map((d) => {
        const checked = selected.has(d.id);
        return (
          <Pressable
            key={d.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${pickLocalized(language, d.nameHi, d.nameEn)}, ${t('sangrah.inMandir')}`}
            onPress={() => onToggle(d.id)}
            style={({ pressed }) => [styles.card, { width: cardWidth }, checked && styles.cardChecked, pressed && styles.pressed]}
          >
            <Image
              source={d.image ? { uri: d.image.urls.card } : FALLBACK_DEITY_IMAGE}
              style={styles.cardImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <AppText variant="body" numberOfLines={1} style={styles.cardName}>
              {pickLocalized(language, d.nameHi, d.nameEn)}
            </AppText>
            <View style={[styles.check, checked && styles.checkOn]}>
              {checked && <MaterialCommunityIcons name="check" size={18} color={colors.white} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.maroon,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.cream },
  countPill: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 2 },
  countText: { color: colors.maroon },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  tab: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelected: { backgroundColor: colors.maroon },
  status: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  hint: { textAlign: 'center' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  rowImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  rowName: { flex: 1, justifyContent: 'center', minHeight: MIN_TAP_TARGET },
  iconButton: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardChecked: { borderColor: colors.saffron },
  cardImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.border },
  cardName: { textAlign: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.saffron },
  pressed: { opacity: 0.75 },
});
