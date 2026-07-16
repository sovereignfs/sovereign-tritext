'use client';

import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Shared dnd-kit sensors for group/block reorder. The drag handle is a
 * dedicated small target (`@sovereignfs/ui`'s `DragHandleRow`), so a small
 * pointer activation distance is enough to distinguish a drag from a click —
 * no long-press/whole-row complexity needed (contrast `sovereign-tasks`,
 * where the whole row is draggable and must exclude embedded controls).
 */
export function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
