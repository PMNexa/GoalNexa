import type { Goal } from "../../lib/api/goals";
import type { Metric } from "../../lib/api/metrics";
import { formatPct, seriesColor } from "./chartUtils";

export interface GoalFilterListProps {
  goals: Goal[];
  /** goal id -> color slot, for shown (charted) goals only. */
  selected: Map<string, number>;
  /** Max goals already shown - hidden goals can't be shown until one is hidden. */
  atLimit: boolean;
  maxGoals: number;
  onToggleGoal: (goalId: string) => void;
  metricsByGoal: Map<string, Metric[]>;
  /** metric id -> its line color slot in the goal's progress-over-time panel (absent = not charted). */
  metricSlot: Map<string, number>;
  disabledMetrics: Set<string>;
  onToggleMetric: (metricId: string) => void;
  /** Goal id -> current progress % (shown metrics only); `null` = no usable metrics. */
  currentByGoal: Map<string, number | null>;
  /** Metrics for the current selection are still loading. */
  loading: boolean;
  onCheckIn: (metricId: string) => void;
}

function formatAmount(value: string): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/* Tabler Icons (MIT), inlined - no icon font is loaded. */
function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const PlusIcon = (
  <SvgIcon>
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </SvgIcon>
);
const EyeIcon = (
  <SvgIcon>
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
  </SvgIcon>
);
const EyeOffIcon = (
  <SvgIcon>
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </SvgIcon>
);

function VisibilityToggle({
  shown,
  name,
  disabled,
  disabledReason,
  onToggle,
}: {
  shown: boolean;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
}) {
  const label = `${shown ? "Hide" : "Show"} ${name}`;
  return (
    <button
      type="button"
      className={`btn btn-icon btn-sm btn-ghost-secondary gn-row-btn gn-eye${shown ? "" : " is-off"}`}
      aria-pressed={shown}
      aria-label={label}
      title={disabled ? disabledReason : label}
      disabled={disabled}
      onClick={onToggle}
    >
      {shown ? EyeIcon : EyeOffIcon}
    </button>
  );
}

/**
 * The dashboard's goal picker, as a tree: each goal is a node (color key,
 * title, current % pill, eye) with a thin progress bar in its series
 * color; a shown goal's metrics hang off it as leaves (tree connector,
 * line-color key + name, current / target, "+" check-in, eye) - the
 * leaves' keys are the legend for each goal's progress-over-time panel. The eye is always the last
 * control on a row. A hidden goal collapses to its muted title; a hidden
 * metric stays in place, dimmed, so it's easy to show again. Styles:
 * `dashboardStyles.ts` (`.gn-goal-*`, `.gn-metric*`, `.gn-row-btn`).
 */
function GoalFilterList({
  goals,
  selected,
  atLimit,
  maxGoals,
  onToggleGoal,
  metricsByGoal,
  metricSlot,
  disabledMetrics,
  onToggleMetric,
  currentByGoal,
  loading,
  onCheckIn,
}: GoalFilterListProps) {
  return (
    <ul className="gn-goal-list" aria-label="Goals">
      {goals.map((goal) => {
        const slot = selected.get(goal.id);
        const shown = slot !== undefined;
        const current = currentByGoal.get(goal.id) ?? null;
        const goalMetrics = shown ? (metricsByGoal.get(goal.id) ?? []) : [];
        return (
          <li
            key={goal.id}
            className={`gn-goal-group${shown ? " is-shown" : ""}${shown && !loading && current !== null ? " has-bar" : ""}`}
          >
            <div className="gn-goal-head">
              <span
                className={`gn-key gn-goal-key${shown ? "" : " is-empty"}`}
                style={shown ? { background: seriesColor(slot) } : undefined}
              />
              <span className="gn-goal-title" title={goal.title}>
                {goal.title}
              </span>
              {shown && !loading ? <span className="gn-goal-pct">{current === null ? "—" : formatPct(current)}</span> : <span />}
              <VisibilityToggle
                shown={shown}
                name={goal.title}
                disabled={!shown && atLimit}
                disabledReason={`Up to ${maxGoals} goals can be shown - hide one first`}
                onToggle={() => onToggleGoal(goal.id)}
              />
              {shown && !loading && current !== null && (
                <div className="gn-goal-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, current)}%`, background: seriesColor(slot) }} />
                </div>
              )}
            </div>

            {shown && !loading && goalMetrics.length === 0 && (
              <ul className="gn-metrics">
                <li className="gn-metric gn-metric-empty">No metrics yet</li>
              </ul>
            )}

            {goalMetrics.length > 0 && (
              <ul className="gn-metrics">
                {goalMetrics.map((metric) => {
                  const metricShown = !disabledMetrics.has(metric.id);
                  const slot = metricSlot.get(metric.id);
                  return (
                    <li key={metric.id} className={`gn-metric${metricShown ? "" : " is-off"}`}>
                      <span className="gn-metric-label">
                        {/* The tree doubles as the panels' legend: the metric's line color. */}
                        <span
                          className="gn-key"
                          style={{ background: metricShown && slot !== undefined ? seriesColor(slot) : "var(--gn-grid)" }}
                        />
                        <span className="gn-metric-name" title={metric.name}>
                          {metric.name}
                        </span>
                      </span>
                      <span className="gn-metric-value">
                        {formatAmount(metric.current_value)}
                        <span className="gn-metric-target">
                          {" / "}
                          {formatAmount(metric.target_value)}
                          {metric.unit ? ` ${metric.unit}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-ghost-primary gn-row-btn"
                        aria-label={`Check in ${metric.name}`}
                        aria-haspopup="dialog"
                        title="Check in"
                        onClick={() => onCheckIn(metric.id)}
                      >
                        {PlusIcon}
                      </button>
                      <VisibilityToggle shown={metricShown} name={metric.name} onToggle={() => onToggleMetric(metric.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default GoalFilterList;
