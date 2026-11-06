import type { ReactNode } from "react";
import { Button, Card, CardBody, FormControl, FormLabel, FormSelect, SegmentedControl, useT } from "platform-core";
import PeriodPicker from "../../components/PeriodPicker";
import type { Cycle } from "../../api/cycles";
import type { BoardTeam, GoalTemplate } from "../../api/teamBoard";
import type { Snap } from "../../lib/periods";
import { MAX_HISTORY, NO_CYCLE, modeOptions, viewOptions, type Mode, type View } from "./boardHelpers";
import messages from "./messages";
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
  /** "+ New" next to Cycle - a cycle of the org. */
  onNewCycle?: () => void;
  /** The team whose subtree is shown ("" = all teams). */
  root: string;
  onRootChange: (root: string) => void;
  /** The board's teams, sorted by name. */
  teams: BoardTeam[];
  /** "+ New" next to Teams - a team under the picked one (top level for "All teams"); owners/admins only. */
  onNewTeam?: () => void;
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
  onNewCycle,
  root,
  onRootChange,
  teams,
  onNewTeam,
  children,
}: BoardPickersProps) {
  const t = useT(messages);
  const rootName = teams.find((team) => team.id === root)?.name;
  return (
    <Card className="mb-3">
      <CardBody className="py-2 d-flex align-items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost-secondary btn-sm gn-fold-btn"
          aria-expanded={!pickersFolded}
          aria-controls="gn-board-pickers"
          title={pickersFolded ? t("showPickers") : t("hidePickers")}
          onClick={() => onFoldedChange(!pickersFolded)}
        >
          {ChevronIcon(!pickersFolded)}
          {t("filters")}
        </button>
        <div className="ms-auto d-flex gap-2 flex-wrap">
          {mode !== "targets" && (
            <SegmentedControl label={t("view")} variant="secondary" options={viewOptions()} value={view} onChange={onViewChange} />
          )}
          <SegmentedControl label={t("mode")} options={modeOptions()} value={mode} onChange={onModeChange} />
        </div>
      </CardBody>
      {!pickersFolded && (
        <CardBody className="border-top">
          <div id="gn-board-pickers" className="row g-2 align-items-start">
            <div className="col-sm-6 col-lg-3 position-relative">
              <FormLabel htmlFor="gn-board-template">{t("goalTemplate")}</FormLabel>
              {onNewTemplate && (
                <Button variant="link" className="p-0 border-0 position-absolute top-0 end-0 me-1" onClick={onNewTemplate}>
                  {t("newButton")}
                </Button>
              )}
              <FormSelect
                id="gn-board-template"
                value={templateId ?? ""}
                onChange={(e) => onTemplateChange(e.target.value)}
                disabled={templates.length === 0}
              >
                {templates.length === 0 && <option value="">{t("noTemplatesYet")}</option>}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.title}</option>
                ))}
              </FormSelect>
            </div>
            <div className="col-sm-6 col-lg-2 position-relative">
              <FormLabel htmlFor="gn-board-cycle">{t("cycle")}</FormLabel>
              {onNewCycle && (
                <Button variant="link" className="p-0 border-0 position-absolute top-0 end-0 me-1" onClick={onNewCycle}>
                  {t("newButton")}
                </Button>
              )}
              <FormSelect
                id="gn-board-cycle"
                value={cycleId}
                onChange={(e) => onCycleChange(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.status === "closed" ? t("cycleClosed", { name: c.name }) : c.name}</option>
                ))}
                <option value={NO_CYCLE}>{t("noCycle")}</option>
              </FormSelect>
            </div>
            <div className="col-sm-6 col-lg-2 position-relative">
              <FormLabel htmlFor="gn-board-root">{t("teams")}</FormLabel>
              {onNewTeam && (
                <Button
                  variant="link"
                  className="p-0 border-0 position-absolute top-0 end-0 me-1"
                  title={rootName ? t("newTeamUnderHint", { name: rootName }) : t("newTopTeam")}
                  onClick={onNewTeam}
                >
                  {t("newButton")}
                </Button>
              )}
              <FormSelect id="gn-board-root" value={root} onChange={(e) => onRootChange(e.target.value)}>
                <option value="">{t("allTeams")}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
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
  const t = useT(messages);
  return (
    <>
      <FormLabel htmlFor="gn-board-when">{t("periods")}</FormLabel>
      <PeriodPicker id="gn-board-when" range per={per} onPerChange={onPerChange} from={from} to={to} onChange={onChange} />
      {capped && <div className="form-hint">{t("upTo", { n: MAX_HISTORY })}</div>}
    </>
  );
}

/** "Checked in at": the moment running totals are shown at (and new check-ins stamped). */
export function MomentPicker({ when, onChange }: { when: string; onChange: (when: string) => void }) {
  const t = useT(messages);
  return (
    <>
      <FormLabel htmlFor="gn-board-when">{t("checkedInAt")}</FormLabel>
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
  const t = useT(messages);
  const per = show || "week";
  return (
    <>
      <FormLabel htmlFor="gn-board-show">{t("showBy")}</FormLabel>
      <PeriodPicker
        id="gn-board-show"
        per={per}
        onPerChange={onShowChange}
        noneTab={t("totalsTab")}
        noneText={t("runningTotals")}
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
