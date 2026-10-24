"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HTMLAttributes } from "react";

export interface DragHandleProps {
  attributes: HTMLAttributes<HTMLElement>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
}

/**
 * Vertical drag-and-drop list (mouse, touch and keyboard). Items must have stable `id`s.
 * Consumers should also render move up/down buttons as an accessible alternative.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
  disabled,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Pritisnite razmaknicu za podizanje stavke, strelice za pomicanje i razmaknicu za spuštanje.",
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} className={itemClassName}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (handle: DragHandleProps) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      className={className}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        position: "relative",
      }}
    >
      {children({ attributes: attributes as HTMLAttributes<HTMLElement>, listeners, isDragging })}
    </li>
  );
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  return arrayMove(items, from, to);
}
