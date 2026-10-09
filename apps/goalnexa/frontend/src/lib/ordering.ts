import { useState, type DragEvent } from "react";
import { apiRequest } from "./api/client";

/**
 * Manual order among siblings (`position`, server-kept - see the backend's
 * `goalnexa/ordering.py`): sub-goals of one goal, top-level goals, metrics
 * of one goal under the same parent metric. Drag and drop moves a row
 * within its sibling group only - a new parent is picked in the edit form.
 */
export type OrderKind = "goal" | "metric";

interface Positioned {
  id: string;
  position?: number;
}

/** Sibling order: `position`, then the name. */
export function byPosition<T extends Positioned>(name: (item: T) => string) {
  return (a: T, b: T) => (a.position ?? 0) - (b.position ?? 0) || name(a).localeCompare(name(b));
}

/** The sibling group a row is dragged within (the server's `sibling_key`). */
export function goalGroup(goal: { parent: string | null }): string {
  return goal.parent ?? "";
}

export function metricGroup(metric: { goal: string; parent: string | null }): string {
  return `${metric.goal}/${metric.parent ?? ""}`;
}

/** `ids` with `dragged` moved to just before (or after) `target`. */
export function moveId(ids: string[], dragged: string, target: string, after: boolean): string[] {
  const rest = ids.filter((id) => id !== dragged);
  const at = rest.indexOf(target);
  if (at < 0) return ids;
  rest.splice(after ? at + 1 : at, 0, dragged);
  return rest;
}

/** `items` with the listed ids numbered 0.. in that order (others untouched), re-sorted. */
export function applyOrder<T extends Positioned>(items: T[], ids: string[], name: (item: T) => string): T[] {
  const index = new Map(ids.map((id, i) => [id, i]));
  return items.map((item) => (index.has(item.id) ? { ...item, position: index.get(item.id) } : item)).sort(byPosition(name));
}

/** Saves a sibling group's order, first to last. */
export function saveOrder(accessToken: string, kind: OrderKind, ids: string[]): Promise<void> {
  return apiRequest<void>(`/api/v1/${kind === "goal" ? "goals" : "metrics"}/reorder`, accessToken, { method: "POST", data: { ids } });
}

/**
 * HTML5 drag and drop between rows of one sibling group. For each row,
 * `dragProps(kind, id, group)` gives `source` (what's grabbed - the row, or
 * just its name cell when the row holds inputs) and `target` (where it
 * drops - the row). A drop calls `onMove` with the dragged row, the row it
 * was dropped on, and which half of it (`after` = the lower half). The
 * target under the pointer gets `data-drop="before|after"` and the dragged
 * one `data-dragging`, for the styles to show.
 */
export function useSiblingDrag(onMove: (kind: OrderKind, dragged: string, target: string, after: boolean) => void) {
  const [drag, setDrag] = useState<{ kind: OrderKind; id: string; group: string } | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);

  function reset() {
    setDrag(null);
    setOver(null);
  }

  return function dragProps(kind: OrderKind, id: string, group: string) {
    const accepts = drag !== null && drag.kind === kind && drag.group === group && drag.id !== id;
    return {
      source: {
        draggable: true,
        onDragStart: (event: DragEvent<HTMLElement>) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
          setDrag({ kind, id, group });
        },
        onDragEnd: reset,
      },
      target: {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (!accepts) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          const box = event.currentTarget.getBoundingClientRect();
          const after = event.clientY > box.top + box.height / 2;
          if (over?.id !== id || over.after !== after) setOver({ id, after });
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          if (!accepts || drag === null) return;
          event.preventDefault();
          event.stopPropagation();
          const after = over?.id === id ? over.after : false;
          reset();
          onMove(kind, drag.id, id, after);
        },
        "data-drop": over?.id === id && accepts ? (over.after ? "after" : "before") : undefined,
        "data-dragging": drag?.id === id ? "" : undefined,
      },
    };
  };
}
