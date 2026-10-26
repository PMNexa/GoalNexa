import { FormLabel, SegmentedControl } from "platform-core";
import GoalPicker, { type GoalPickerOption } from "../../components/GoalPicker";
import { SNAPS, WEEKDAYS, type Snap } from "./tableColumns";

export type TableView = "table" | "chart";
const VIEWS: { value: TableView; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "chart", label: "Chart" },
];

export interface TableToolbarProps {
  goalOptions: GoalPickerOption[];
  /** The goals picked to show (none = all). */
  picked: Set<string>;
  onPickedChange: (next: Set<string>) => void;
  /** No table yet (loading): the picker waits. */
  pickerDisabled: boolean;
  onNewGoal: () => void;
  newGoalDisabled: boolean;
  view: TableView;
  onViewChange: (view: TableView) => void;
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /** The day a week starts (0 = Sunday), asked only while snapping to weeks. */
  weekStart: number;
  onWeekStartChange: (day: number) => void;
}

/** The check-in table's toolbar: Goals picker, New goal, Table/Chart, Snap to (and the week's first day). */
export function TableToolbar({
  goalOptions,
  picked,
  onPickedChange,
  pickerDisabled,
  onNewGoal,
  newGoalDisabled,
  view,
  onViewChange,
  snap,
  onSnapChange,
  weekStart,
  onWeekStartChange,
}: TableToolbarProps) {
  return (
    <div className="d-flex align-items-end gap-3 mb-3">
      <div>
        <FormLabel>Goals</FormLabel>
        <GoalPicker
          options={goalOptions}
          selected={picked}
          onChange={onPickedChange}
          disabled={pickerDisabled}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onNewGoal}
        disabled={newGoalDisabled}
      >
        New goal
      </button>
      <div className="ms-auto">
        <SegmentedControl label="View" variant="secondary" options={VIEWS} value={view} onChange={onViewChange} />
      </div>
      <div>
        <FormLabel htmlFor="table-snap">Snap to</FormLabel>
        <div className="d-flex gap-2">
          <select
            id="table-snap"
            className="form-select form-select-sm w-auto"
            value={snap}
            onChange={(event) => onSnapChange(event.target.value as Snap)}
          >
            {SNAPS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {snap === "week" && (
            <select
              aria-label="Week starts on"
              title="Week starts on"
              className="form-select form-select-sm w-auto"
              value={weekStart}
              onChange={(event) => onWeekStartChange(Number(event.target.value))}
            >
              {WEEKDAYS.map((name, day) => (
                <option key={name} value={day}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
