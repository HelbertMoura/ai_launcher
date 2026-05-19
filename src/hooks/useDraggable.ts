import { useCallback, useState, type DragEvent } from "react";

export interface DragStartHandlers {
  draggable: true;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: (e: DragEvent<HTMLElement>) => void;
}

export interface DropHandlers {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragEnter: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

export interface UseDraggable {
  draggedKey: string | null;
  dropTargetKey: string | null;
  startHandlers: (key: string) => DragStartHandlers;
  dropHandlers: (key: string) => DropHandlers;
}

/**
 * Hook para reordenação por drag-and-drop entre cards.
 * Mantém estado local de drag/drop e chama `setOrder` quando o usuário solta.
 *
 * @param orderedKeys lista atual de chaves na ordem visível
 * @param setOrder callback que persiste a nova ordem
 */
export function useDraggable(
  orderedKeys: string[],
  setOrder: (next: string[]) => void,
): UseDraggable {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const startHandlers = useCallback(
    (key: string): DragStartHandlers => ({
      draggable: true,
      onDragStart: (e) => {
        setDraggedKey(key);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", key);
      },
      onDragEnd: () => {
        setDraggedKey(null);
        setDropTargetKey(null);
      },
    }),
    [],
  );

  const dropHandlers = useCallback(
    (key: string): DropHandlers => ({
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: (e) => {
        e.preventDefault();
        if (draggedKey && draggedKey !== key) {
          setDropTargetKey(key);
        }
      },
      onDragLeave: (e) => {
        const related = e.relatedTarget as Node | null;
        if (!related || !(e.currentTarget as Node).contains(related)) {
          setDropTargetKey((curr) => (curr === key ? null : curr));
        }
      },
      onDrop: (e) => {
        e.preventDefault();
        const moved = draggedKey;
        setDropTargetKey(null);
        setDraggedKey(null);
        if (!moved || moved === key) return;
        const oldIdx = orderedKeys.indexOf(moved);
        const newIdx = orderedKeys.indexOf(key);
        if (oldIdx === -1 || newIdx === -1) return;
        const next = [...orderedKeys];
        next.splice(oldIdx, 1);
        next.splice(newIdx, 0, moved);
        setOrder(next);
      },
    }),
    [draggedKey, orderedKeys, setOrder],
  );

  return { draggedKey, dropTargetKey, startHandlers, dropHandlers };
}
