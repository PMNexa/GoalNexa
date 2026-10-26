import type { Snap } from "./tableColumns";

export interface DraftColumnHeaderProps {
  snap: Snap;
  /** The picker's value, in the column size's own format. */
  value: string;
  onChange: (value: string) => void;
  /** How many metrics have a value typed in. */
  filledCount: number;
  /** The draft has a time (it always does unless cleared). */
  hasTime: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
}

/** The new check-in column's header: when it's for (an hour, day, week or month) and its Save button. */
export function DraftColumnHeader({
  snap,
  value,
  onChange,
  filledCount,
  hasTime,
  saving,
  saveError,
  onSave,
}: DraftColumnHeaderProps) {
  return (
    <th className="gn-draft">
      <div className="d-flex align-items-center gap-2">
        <input
          type={
            snap === "hour"
              ? "datetime-local"
              : snap === "month"
                ? "month"
                : "date"
          }
          step={snap === "hour" ? 3600 : undefined}
          className="form-control form-control-sm"
          aria-label={`New check-in ${snap}`}
          title={
            snap === "week"
              ? "The week it counts for (starts on the day chosen above)"
              : undefined
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saving || filledCount === 0 || !hasTime}
          onClick={onSave}
        >
          {saving
            ? "Saving…"
            : filledCount
              ? `Save ${filledCount}`
              : "Save"}
        </button>
      </div>
      {saveError && (
        <span className="gn-sub text-danger">{saveError}</span>
      )}
    </th>
  );
}
