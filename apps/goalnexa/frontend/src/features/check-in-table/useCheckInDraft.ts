import { useState } from "react";
import type { CheckIn } from "../../api/checkIns";
import { apiRequest } from "../../api/client";
import { bucketKey, nowLocal, weekStartOf, type Snap } from "./tableColumns";

export interface CheckInDraftOptions {
  accessToken: string;
  snap: Snap;
  weekStart: number;
  /** A metric's name, for the "Couldn't save" message. */
  metricName: (id: string) => string | undefined;
  /** After a save (even a partly failed one) - reload the table. */
  onSaved: () => void;
}

/**
 * The new check-in column: one time for the whole column, a value per
 * metric, saved as one check-in per filled value.
 */
export function useCheckInDraft({
  accessToken,
  snap,
  weekStart,
  metricName,
  onSaved,
}: CheckInDraftOptions) {
  // The new check-in column: one time for the whole column, a value per metric.
  const [draftWhen, setDraftWhen] = useState(nowLocal);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filled = Object.entries(draftValues).filter(
    ([, v]) => v.trim() !== "" && Number.isFinite(Number(v)),
  );

  // The picker follows the column size; the draft itself stays one local date-time, whose time of day is kept.
  const draftInputValue =
    snap === "hour"
      ? `${draftWhen.slice(0, 13)}:00`
      : snap === "month"
        ? draftWhen.slice(0, 7)
        : snap === "week"
          ? weekStartOf(draftWhen.slice(0, 10), weekStart)
          : draftWhen.slice(0, 10);

  function changeDraft(value: string) {
    if (!value) return;
    const time = draftWhen.slice(10);
    if (snap === "hour") setDraftWhen(value);
    else if (snap === "month") setDraftWhen(`${value}-01${time}`);
    else if (snap === "week")
      setDraftWhen(`${weekStartOf(value, weekStart)}${time}`);
    else setDraftWhen(`${value}${time}`);
  }

  function setDraftValue(metric: string, value: string) {
    setDraftValues((prev) => ({
      ...prev,
      [metric]: value,
    }));
  }

  async function saveDraft() {
    if (filled.length === 0 || !draftWhen) return;
    setSaving(true);
    setSaveError(null);
    // Picking the current hour/day/week/month means "now"; any other column keeps the draft's own time.
    const chosen = new Date(
      `${snap === "hour" ? draftWhen.slice(0, 13) + ":00" : draftWhen}`,
    );
    const when = (
      bucketKey(chosen.getTime(), snap, weekStart) ===
      bucketKey(Date.now(), snap, weekStart)
        ? new Date()
        : chosen
    ).toISOString();
    const failed: string[] = [];
    for (const [metric, value] of filled) {
      try {
        await apiRequest<CheckIn>("/api/v1/check-ins", accessToken, {
          method: "POST",
          data: { metric, value: Number(value), checked_in_at: when },
        });
        setDraftValues((prev) => {
          const { [metric]: _saved, ...rest } = prev;
          return rest;
        });
      } catch {
        failed.push(metricName(metric) ?? metric);
      }
    }
    setSaving(false);
    if (failed.length) setSaveError(`Couldn't save: ${failed.join(", ")}`);
    else setDraftWhen(nowLocal());
    onSaved();
  }

  return {
    draftWhen,
    draftValues,
    setDraftValue,
    draftInputValue,
    changeDraft,
    filledCount: filled.length,
    saving,
    saveError,
    saveDraft,
  };
}
