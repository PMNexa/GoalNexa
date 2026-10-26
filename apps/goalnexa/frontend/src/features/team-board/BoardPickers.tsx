import type { ReactNode } from "react";
import { Button, Card, CardBody, FormControl, FormLabel, FormSelect, SegmentedControl } from "platform-core";
import PeriodPicker from "../../components/PeriodPicker";
import type { Cycle } from "../../api/cycles";
import type { BoardTeam, GoalTemplate } from "../../api/teamBoard";
import type { Snap } from "../../lib/periods";
import { MAX_HISTORY, MODES, NO_CYCLE, VIEWS, type Mode, type View } from "./boardHelpers";
import { ChevronIcon } from "./boardIcons";

export interface BoardPickersProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  view: View;
  onViewChange: (view: View) => void;
  /** The card folds to one summary line. */
  pickersFolded: boolean;
  onFoldedChange: (folded: boolean) => void;
  templates: GoalTemplate[];
  templateId: string | null;
  onTemplateChange: (templateId: string) => void;
  /** "+ New" (the template wizard) - only for the org's owners/admins. */
  onNewTemplate?: () => void;
  cycles: Cycle[];
  cycleId: string;
  onCycleChange: (cycleId: string) => void;
  /** The team whose subtree is shown ("" = all teams). */
  root: string;
  onRootChange: (root: string) => void;
  /** The board's teams, sorted by name. */
  teams: BoardTeam[];
  /** The mode's period pickers (`RangePicker`, `ShowPicker`, `MomentPicker`), each in its column. */
  children?: ReactNode;
}

/**
 * The board's pickers card: the View and Mode switches on its first line
 * (with the Filters fold), then the template, cycle, team subtree and the
 * mode's period pickers.
 */
function BoardPickers({
  mode,
  onModeChange,
  view,
  onViewChange,
  pickersFolded,
  onFoldedChange,
  templates,
  templateId,
  onTemplateChange,
  onNewTemplate,
  cycles,
  cycleId,
  onCycleChange,
  root,
  onRootChange,
  teams,
  children,
}: BoardPickersProps) {
  return (
    <Card className="mb-3">
      <CardBody className="py-2 d-flex align-items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost-secondary btn-sm gn-fold-btn"
          aria-expanded={!pickersFolded}
          aria-controls="gn-board-pickers"
          title={pickersFolded ? "Show the pickers" : "Hide the pickers"}
          onClick={() => onFoldedChange(!pickersFolded)}
        >
          {ChevronIcon(!pickersFolded)}
          Filters
        </button>
        <div className="ms-auto d-flex gap-2 flex-wrap">
          {mode !== "targets" && (
            <SegmentedControl label="View" variant="secondary" options={VIEWS} value={view} onChange={onViewChange} />
          )}
          <SegmentedControl label="Mode" options={MODES} value={mode} onChange={onModeChange} />
        </div>
      </CardBody>
      {!pickersFolded && (
        <CardBody className="border-top">
          <div id="gn-board-pickers" className="row g-2 align-items-start">
            <div className="col-sm-6 col-lg-3 position-relative">
              <FormLabel htmlFor="gn-board-template">Goal template</FormLabel>
              {onNewTemplate && (
                <Button variant="link" className="p-0 border-0 position-absolute top-0 end-0 me-1" onClick={onNewTemplate}>
                  + New
                </Button>
              )}
              <FormSelect
                id="gn-board-template"
                value={templateId ?? ""}
                onChange={(e) => onTemplateChange(e.target.value)}
                disabled={templates.length === 0}
              >
                {templates.length === 0 && <option value="">No templates yet</option>}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </FormSelect>
            </div>
            <div className="col-sm-6 col-lg-2">
              <FormLabel htmlFor="gn-board-cycle">Cycle</FormLabel>
              <FormSelect
                id="gn-board-cycle"
                value={cycleId}
                onChange={(e) => onCycleChange(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.status === "closed" ? " (closed)" : ""}</option>
                ))}
                <option value={NO_CYCLE}>No cycle</option>
              </FormSelect>
            </div>
            <div className="col-sm-6 col-lg-2">
              <FormLabel htmlFor="gn-board-root">Teams</FormLabel>
              <FormSelect id="gn-board-root" value={root} onChange={(e) => onRootChange(e.target.value)}>
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </FormSelect>
            </div>
            {children}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

/** Over time: the first and last period, picked by day/week/... (at most MAX_HISTORY periods). */
export function RangePicker({
  per,
  from,
  to,
  capped,
  onPerChange,
  onChange,
}: {
  per: Snap;
  /** The first days of the first and last period shown. */
  from: number;
  to: number;
  /** The picked range was longer than MAX_HISTORY - only the latest are shown. */
  capped: boolean;
  onPerChange: (per: Snap) => void;
  onChange: (first: number, last: number) => void;
}) {
  return (
    <>
      <FormLabel htmlFor="gn-board-when">Periods</FormLabel>
      <PeriodPicker id="gn-board-when" range per={per} onPerChange={onPerChange} from={from} to={to} onChange={onChange} />
      {capped && <div className="form-hint">Up to {MAX_HISTORY} at a time - the latest shown.</div>}
    </>
  );
}

/** "Checked in at": the moment running totals are shown at (and new check-ins stamped). */
export function MomentPicker({ when, onChange }: { when: string; onChange: (when: string) => void }) {
  return (
    <>
      <FormLabel htmlFor="gn-board-when">Checked in at</FormLabel>
      <FormControl id="gn-board-when" type="datetime-local" value={when} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

/** "Show by": running totals (the Totals tab) or one period, picked in one control. */
export function ShowPicker({
  show,
  picked,
  onShowChange,
  onPick,
}: {
  /** The period shown by ("" = running totals). */
  show: Snap | "";
  /** The first day of the picked period (of `show`, or a week while on Totals). */
  picked: number;
  onShowChange: (show: Snap | "") => void;
  /** A period picked: its first day, and the kind of period it was picked in. */
  onPick: (last: number, per: Snap) => void;
}) {
  const per = show || "week";
  return (
    <>
      <FormLabel htmlFor="gn-board-show">Show by</FormLabel>
      <PeriodPicker
        id="gn-board-show"
        per={per}
        onPerChange={onShowChange}
        noneTab="Totals"
        noneText="Running totals"
        none={!show}
        onNone={() => onShowChange("")}
        from={picked}
        to={picked}
        onChange={(_, last) => onPick(last, per)}
      />
    </>
  );
}

export default BoardPickers;
