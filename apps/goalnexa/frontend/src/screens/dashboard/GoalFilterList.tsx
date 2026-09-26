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
  /** A goal's / metric's name was clicked - the host shows its details. */
  onOpenGoal: (goalId: string) => void;
  onOpenMetric: (metricId: string) => void;
}

function formatAmount(value: string): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** A name's hover text: the name, plus its description when there is one. */
function withDescription(name: string, description: string | undefined): string {
  return description?.trim() ? `${name}\n${description.trim()}` : name;
}

/** Compact for the narrow tree row (93,500,000 -> "93.5M", 200,000 -> "200K"); the exact figures stay in the row's tooltip. */
const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

function formatCompact(value: string): string {
  return COMPACT.format(Number(value));
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

interface TreeNode<T> {
  item: T;
  children: TreeNode<T>[];
}

/**
 * Nest items under their `parent`, keeping the given order among
 * siblings. An item whose parent isn't in the list (e.g. a sub-goal of a
 * goal in another org) is a root; so is anything caught in a parent cycle
 * (A -> B -> A isn't prevented server-side yet), rather than vanishing.
 */
function buildTree<T extends { id: string; parent: string | null }>(items: T[]): TreeNode<T>[] {
  const ids = new Set(items.map((item) => item.id));
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.parent !== null && item.parent !== item.id && ids.has(item.parent) ? item.parent : null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const placed = new Set<string>();
  const build = (parent: string | null): TreeNode<T>[] =>
    (byParent.get(parent) ?? [])
      .filter((item) => !placed.has(item.id) && placed.add(item.id))
      .map((item) => ({ item, children: build(item.id) }));
  const roots = build(null);
  for (const item of items) {
    if (!placed.has(item.id)) {
      placed.add(item.id);
      roots.push({ item, children: build(item.id) });
    }
  }
  return roots;
}

/**
 * The dashboard's goal picker, as a tree: each goal is a node (color key,
 * title, current % pill, eye) with a thin progress bar in its series
 * color. Its branches: its metrics (only while the goal is shown), then
 * its sub-goals (always - a sub-goal is shown/hidden on its own). A
 * metric row is line-color key + name, current / target, "+" check-in,
 * eye, with its sub-metrics nested under it - the metric keys are the
 * legend for each goal's progress-over-time panel. The eye is
 * always the last control on a row. A hidden goal collapses to its muted
 * title; a hidden metric stays in place, dimmed, so it's easy to show
 * again. A goal's or metric's name is a button: the host opens its
 * details. Styles: `dashboardStyles.ts` (`.gn-goal-*`, `.gn-branch*`,
 * `.gn-metric*`, `.gn-row-btn`).
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
  onOpenGoal,
  onOpenMetric,
}: GoalFilterListProps) {
  function renderMetric({ item: metric, children }: TreeNode<Metric>) {
    const metricShown = !disabledMetrics.has(metric.id);
    const slot = metricSlot.get(metric.id);
    return (
      <li key={metric.id} className="gn-branch gn-metric">
        <div className={`gn-metric-row${metricShown ? "" : " is-off"}${children.length > 0 ? " has-branches" : ""}`}>
          <span className="gn-metric-label">
            {/* The tree doubles as the panels' legend: the metric's line color. */}
            <span
              className="gn-key"
              style={{ background: metricShown && slot !== undefined ? seriesColor(slot) : "var(--gn-grid)" }}
            />
            <button
              type="button"
              className="gn-name-btn"
              title={withDescription(metric.name, metric.description)}
              aria-haspopup="dialog"
              onClick={() => onOpenMetric(metric.id)}
            >
              <span className="gn-metric-name">{metric.name}</span>
            </button>
          </span>
          <span
            className="gn-metric-value"
            title={`${formatAmount(metric.current_value)} / ${formatAmount(metric.target_value)}${metric.unit ? ` ${metric.unit}` : ""}${
              Number(metric.base_value) === 0 ? "" : ` (from ${formatAmount(metric.base_value)})`
            }`}
          >
            {formatCompact(metric.current_value)}
            <span className="gn-metric-target">
              {" / "}
              {formatCompact(metric.target_value)}
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
        </div>
        {children.length > 0 && <ul className="gn-branches">{children.map(renderMetric)}</ul>}
      </li>
    );
  }

  function renderGoal({ item: goal, children: subGoals }: TreeNode<Goal>, nested: boolean) {
    const slot = selected.get(goal.id);
    const shown = slot !== undefined;
    const current = currentByGoal.get(goal.id) ?? null;
    const metricTree = shown ? buildTree(metricsByGoal.get(goal.id) ?? []) : [];
    const noMetrics = shown && !loading && metricTree.length === 0;
    const hasBranches = metricTree.length > 0 || noMetrics || subGoals.length > 0;
    return (
      <li key={goal.id} className={`gn-goal-group${nested ? " gn-branch" : ""}${shown ? " is-shown" : ""}`}>
        <div className={`gn-goal-head${hasBranches ? " has-branches" : ""}`}>
          <span
            className={`gn-key gn-goal-key${shown ? "" : " is-empty"}`}
            style={shown ? { background: seriesColor(slot) } : undefined}
          />
          <button
            type="button"
            className="gn-name-btn"
            title={withDescription(goal.title, goal.description)}
            aria-haspopup="dialog"
            onClick={() => onOpenGoal(goal.id)}
          >
            <span className="gn-goal-title">{goal.title}</span>
          </button>
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

        {hasBranches && (
          <ul className="gn-branches">
            {noMetrics && <li className="gn-branch gn-metric-empty">No metrics yet</li>}
            {metricTree.map(renderMetric)}
            {subGoals.map((node) => renderGoal(node, true))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <ul className="gn-goal-list" aria-label="Goals">
      {buildTree(goals).map((node) => renderGoal(node, false))}
    </ul>
  );
}

export default GoalFilterList;
