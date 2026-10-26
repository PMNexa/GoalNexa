import { useState } from "react";
import type { TargetChange } from "../../api/teamBoard";

export type TargetField = "base_value" | "target_value" | "planned_target";

/** What's typed into the board and not saved yet: check-in values and notes (by metric id), open note fields, target changes. */
export interface BoardDrafts {
  values: Map<string, string>;
  notes: Map<string, string>;
  openNotes: Set<string>;
  targets: Map<string, TargetChange>;
  setValue: (metricId: string, value: string) => void;
  setNote: (metricId: string, note: string) => void;
  toggleNote: (metricId: string) => void;
  editTarget: (metricId: string, field: TargetField, value: string) => void;
  reset: () => void;
}

export function useBoardDrafts(): BoardDrafts {
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Map<string, TargetChange>>(new Map());

  function reset() {
    setValues(new Map());
    setNotes(new Map());
    setOpenNotes(new Set());
    setTargets(new Map());
  }

  function editTarget(metricId: string, field: TargetField, value: string) {
    setTargets((prev) => {
      const next = new Map(prev);
      next.set(metricId, { ...(next.get(metricId) ?? { metric: metricId }), [field]: value });
      return next;
    });
  }

  return {
    values,
    notes,
    openNotes,
    targets,
    setValue: (metricId, value) => setValues((prev) => new Map(prev).set(metricId, value)),
    setNote: (metricId, note) => setNotes((prev) => new Map(prev).set(metricId, note)),
    toggleNote: (metricId) =>
      setOpenNotes((prev) => {
        const next = new Set(prev);
        if (next.has(metricId)) next.delete(metricId);
        else next.add(metricId);
        return next;
      }),
    editTarget,
    reset,
  };
}
