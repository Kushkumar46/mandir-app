import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/theme';

import { dragTargetIndex, movePositions, orderFromPositions, positionsOf } from '../../sangrah';

const SETTLE = { duration: 150 };
/** Press and hold before a row lifts, so a normal swipe still scrolls the page. */
const LIFT_AFTER_MS = 250;

type Props = {
  ids: readonly string[];
  rowHeight: number;
  renderRow: (id: string, index: number) => ReactNode;
  /** Called on drop with the new order (only when it changed). */
  onReorder: (ids: string[]) => void;
  /** True while a row is lifted — the parent disables page scrolling. */
  onDragChange?: (dragging: boolean) => void;
};

/**
 * Fixed-height rows reordered by long-press + drag (VM-03). Rows move on the UI thread; the new
 * order reaches JS once, on drop.
 */
export function ReorderableList({ ids, rowHeight, renderRow, onReorder, onDragChange }: Props) {
  const positions = useSharedValue(positionsOf(ids));
  const idsKey = ids.join('|');

  useEffect(() => {
    positions.set(positionsOf(idsKey.split('|')));
  }, [idsKey, positions]);

  const onDrop = (next: Record<string, number>) => {
    const order = orderFromPositions(next);
    if (order.join('|') !== idsKey) onReorder(order);
  };

  return (
    <View style={{ height: ids.length * rowHeight }}>
      {ids.map((id, index) => (
        <DraggableRow
          key={id}
          id={id}
          index={index}
          count={ids.length}
          rowHeight={rowHeight}
          positions={positions}
          onDrop={onDrop}
          onDragChange={onDragChange}
        >
          {renderRow(id, index)}
        </DraggableRow>
      ))}
    </View>
  );
}

type RowProps = {
  id: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Record<string, number>>;
  onDrop: (positions: Record<string, number>) => void;
  onDragChange?: (dragging: boolean) => void;
  children: ReactNode;
};

function DraggableRow({ id, index, count, rowHeight, positions, onDrop, onDragChange, children }: RowProps) {
  const top = useSharedValue(index * rowHeight);
  const startTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const scale = useSharedValue(1);

  // Follow position changes made by other rows' drags (and list changes from JS).
  useAnimatedReaction(
    () => positions.get()[id],
    (pos, prev) => {
      if (pos === undefined || pos === prev || dragging.get()) return;
      top.set(withTiming(pos * rowHeight, SETTLE));
    },
  );

  const setDragging = (value: boolean) => onDragChange?.(value);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_AFTER_MS)
    .onStart(() => {
      dragging.set(true);
      scale.set(withTiming(1.03, SETTLE));
      startTop.set(top.get());
      scheduleOnRN(setDragging, true);
    })
    .onUpdate((e) => {
      const y = Math.min((count - 1) * rowHeight, Math.max(0, startTop.get() + e.translationY));
      top.set(y);
      const from = positions.get()[id]!;
      const to = dragTargetIndex(y, rowHeight, count);
      if (to !== from) positions.set(movePositions(positions.get(), from, to));
    })
    .onFinalize(() => {
      if (!dragging.get()) return;
      dragging.set(false);
      scale.set(withTiming(1, SETTLE));
      top.set(withTiming(positions.get()[id]! * rowHeight, SETTLE));
      scheduleOnRN(onDrop, positions.get());
      scheduleOnRN(setDragging, false);
    });

  const style = useAnimatedStyle(() => {
    const lifted = dragging.get();
    return {
      top: top.get(),
      zIndex: lifted ? 10 : 0,
      elevation: lifted ? 6 : 0,
      shadowOpacity: lifted ? 0.2 : 0,
      transform: [{ scale: scale.get() }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, { height: rowHeight }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
});
