import { FormLabel, SegmentedControl, useLocale, useT } from "platform-core";
import GoalPicker, { type GoalPickerOption } from "../../components/GoalPicker";
import { SNAPS, weekdayName, type Snap } from "./tableColumns";
import messages from "./messages";

export type TableView = "table" | "chart";
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

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
  const t = useT(messages);
  const locale = useLocale();
  const views: { value: TableView; label: string }[] = [
    { value: "table", label: t("viewTable") },
    { value: "chart", label: t("viewChart") },
  ];
  return (
    <div className="d-flex align-items-end gap-3 mb-3">
      <div>
        <FormLabel>{t("goals")}</FormLabel>
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
        {t("newGoal")}
      </button>
      <div className="ms-auto">
        <SegmentedControl label={t("view")} variant="secondary" options={views} value={view} onChange={onViewChange} />
      </div>
      <div>
        <FormLabel htmlFor="table-snap">{t("snapTo")}</FormLabel>
        <div className="d-flex gap-2">
          <select
            id="table-snap"
            className="form-select form-select-sm w-auto"
            value={snap}
            onChange={(event) => onSnapChange(event.target.value as Snap)}
          >
            {SNAPS.map((option) => (
              <option key={option} value={option}>
                {t(`snap_${option}`)}
              </option>
            ))}
          </select>
          {snap === "week" && (
            <select
              aria-label={t("weekStartsOn")}
              title={t("weekStartsOn")}
              className="form-select form-select-sm w-auto"
              value={weekStart}
              onChange={(event) => onWeekStartChange(Number(event.target.value))}
            >
              {WEEK_DAYS.map((day) => (
                <option key={day} value={day}>
                  {weekdayName(day, locale)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
