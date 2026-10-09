/**
 * Dashboard chart tokens. Categorical slots are the dataviz reference
 * palette (validated order - adjacent-pair CVD/normal-vision gates pass
 * in both modes for up to 8 series, which is why the goal picker caps
 * at 8). Text/grid/surface reuse Tabler's own variables so charts follow
 * whatever theme the host's Tabler is in; the dark series steps are
 * selected per the palette's dark column, not an automatic flip.
 *
 * A TS string rendered via React 19's `<style href precedence>` (hoisted
 * into <head>, deduped by `href`), NOT a `.css` import: this package's
 * `"."` entry is also loaded by react-router's route-config loader (the
 * host's `routes.ts` imports `createDashboardRoutes` from it), which runs
 * a minimal Vite that crashes on CSS imports ("Cannot read properties of
 * undefined (reading 'get')").
 */
export const DASHBOARD_CSS = `/* Tokens live on the dashboard root (and on .gn-viz, for a chart used on
   its own) - the filter card's color keys sit outside the charts. */
.gn-dashboard,
.gn-viz {
  --gn-surface: var(--tblr-bg-surface, #fff);
  --gn-text-primary: var(--tblr-body-color, #1d273b);
  --gn-text-secondary: var(--tblr-secondary, #667382);
  --gn-grid: var(--tblr-border-color, #e6e7e9);
  --gn-axis: var(--tblr-border-color-dark, #c8cdd3);
  --gn-series-1: #2a78d6;
  --gn-series-2: #eb6834;
  --gn-series-3: #1baf7a;
  --gn-series-4: #eda100;
  --gn-series-5: #e87ba4;
  --gn-series-6: #008300;
  --gn-series-7: #4a3aa7;
  --gn-series-8: #e34948;
}
.gn-viz {
  position: relative;
}
[data-bs-theme="dark"] .gn-dashboard,
[data-bs-theme="dark"] .gn-viz {
  --gn-series-1: #3987e5;
  --gn-series-2: #d95926;
  --gn-series-3: #199e70;
  --gn-series-4: #c98500;
  --gn-series-5: #d55181;
  --gn-series-6: #008300;
  --gn-series-7: #9085e9;
  --gn-series-8: #e66767;
}

.gn-viz svg {
  display: block;
  width: 100%;
  overflow: visible;
  font-family: inherit;
}
.gn-viz .gn-tick {
  font-size: 11px;
  fill: var(--gn-text-secondary);
  font-variant-numeric: tabular-nums;
}
.gn-viz .gn-marker {
  paint-order: stroke;
  stroke: var(--gn-surface);
  stroke-width: 3px;
}
.gn-projected {
  color: var(--gn-text-secondary);
  font-style: italic;
}
.gn-viz .gn-label {
  font-size: 12px;
  fill: var(--gn-text-primary);
}
.gn-viz .gn-value {
  font-size: 12px;
  font-weight: 600;
  fill: var(--gn-text-primary);
  font-variant-numeric: tabular-nums;
}

.gn-tooltip {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  min-width: 160px;
  max-width: 260px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--gn-surface);
  color: var(--gn-text-primary);
  border: 1px solid var(--gn-grid);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  line-height: 1.4;
}
.gn-tooltip-title {
  color: var(--gn-text-secondary);
  margin-bottom: 4px;
}
.gn-tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gn-tooltip-row .gn-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gn-tooltip-item + .gn-tooltip-item {
  margin-top: 4px;
}
/* The actual reading under a series' % - indented past its color key. */
.gn-tooltip-detail {
  padding-inline-start: 18px;
  color: var(--gn-text-secondary);
  font-variant-numeric: tabular-nums;
}
.gn-tooltip-row .gn-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.gn-key {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 3px;
  border-radius: 2px;
}
.gn-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--gn-text-secondary);
}
.gn-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
}
.gn-legend-item span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A scroll box clips at its padding edge - including Tabler's 0.25rem
   focus ring (box-shadow) on a checkbox sitting flush against it. Pad by
   the ring width and pull back with an equal negative margin, so the ring
   has room and the layout doesn't move. */
.gn-goal-list {
  max-height: 560px;
  overflow-y: auto;
  padding: 0.25rem;
  margin: -0.25rem;
}
/* Desktop: the filters and the charts scroll on their own, each filling
   the viewport under the app's sticky header (64px) - so the goal tree
   stays in reach while scrolling charts, and the reverse. No page
   margin or row gutter above/below: the panes (and their scrollbars) sit flush against the
   header and the bottom edge, reading as panels that scroll. The goal
   list then needs no scroll box of its own. */
@media (min-width: 992px) {
  .page-body:has(> * > .gn-dashboard) {
    margin-block: 0;
  }
  .gn-dashboard {
    --tblr-gutter-y: 0;
  }
  .gn-pane {
    height: calc(100dvh - 64px);
    /* Inside the scroll box: the scrollbar runs edge to edge, the
       content starts and ends with breathing room. */
    padding-block: 1rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }
  .gn-pane .gn-goal-list {
    max-height: none;
    overflow-y: visible;
  }
}

/* The goal list is a tree: goal nodes, with their metrics then their
   sub-goals as branches, and a metric's sub-metrics under it. Every row
   ends with its controls, the eye (show/hide) always last. */
.gn-goal-list,
.gn-branches {
  list-style: none;
}
.gn-goal-list > .gn-goal-group {
  padding-block: 0.625rem;
}
.gn-goal-list > .gn-goal-group:first-child {
  padding-top: 0.25rem;
}
.gn-goal-list > .gn-goal-group + .gn-goal-group {
  border-top: 1px solid var(--tblr-border-color, #e6e7e9);
}
.gn-branch.gn-goal-group {
  padding-block: 0.25rem;
}

/* Goal node: [key] [title] [% pill] [eye], progress bar under the title. */
/* Top-aligned, so the key sits at a fixed height (centred on the 1.75rem
   first row, 0.875rem down) whether the title takes 1 line or 2 - the
   tree connectors are drawn against that height. */
.gn-goal-head {
  position: relative;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) 1.25rem auto auto auto;
  align-items: start;
  column-gap: 0.5rem;
}
.gn-goal-head > .gn-goal-key {
  margin-top: calc(0.875rem - 1.5px);
}
.gn-goal-head > .gn-name-btn,
.gn-goal-head > .gn-goal-pct {
  margin-top: 0.25rem;
}
.gn-goal-key.is-empty {
  background: var(--gn-grid);
}
.gn-goal-title {
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.25rem;
  color: var(--gn-text-primary);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* A goal's / metric's name opens its details - a bare button, text-styled. */
.gn-name-btn {
  display: block;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.gn-name-btn:not(.is-static):hover > span {
  text-decoration: underline;
}
.gn-goal-group:not(.is-shown) > .gn-goal-head .gn-goal-title {
  font-weight: 500;
  color: var(--gn-text-secondary);
}
.gn-goal-projection {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--gn-text-secondary);
  font-variant-numeric: tabular-nums;
}
/* A goal's health, next to its projection: a status dot + label (never color alone). */
.gn-health {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gn-text-secondary);
  white-space: nowrap;
}
.gn-health::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gn-health, var(--gn-grid));
}
.gn-health.is-on_track,
.gn-health.is-achieved {
  --gn-health: var(--tblr-success, #2fb344);
}
.gn-health.is-at_risk {
  --gn-health: var(--tblr-warning, #f76707);
}
/* Only tracked metrics (no targets): a neutral dot, no verdict. */
.gn-health.is-tracking {
  --gn-health: var(--gn-text-secondary);
}
/* Tracked metrics (target = base): one value chart each, two across when there's room. */
.gn-tracked-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px 24px;
}
.gn-tracked-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 2px;
}
.gn-tracked-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gn-text-secondary);
}
.gn-tracked-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--gn-text-primary);
}
.gn-health.is-off_track {
  --gn-health: var(--tblr-danger, #d63939);
}
/* A metric's scheduled check-in is due: a clock after its name - checks in. */
.gn-due {
  display: inline-flex;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tblr-warning, #f76707);
  cursor: pointer;
}
.gn-due svg {
  width: 14px;
  height: 14px;
}
.gn-due:focus-visible {
  outline: 2px solid var(--tblr-primary, #206bc4);
  outline-offset: 1px;
  border-radius: 2px;
}
.gn-goal-pct {
  padding: 0 0.5rem;
  border-radius: 999px;
  background: var(--tblr-bg-surface-secondary, #f6f8fb);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25rem;
  color: var(--gn-text-primary);
  font-variant-numeric: tabular-nums;
}
.gn-goal-bar {
  grid-column: 2 / 4;
  height: 4px;
  margin-top: 0.375rem;
  border-radius: 2px;
  background: var(--gn-grid);
  overflow: hidden;
}
.gn-goal-bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
}

/* Tree connectors. A branch list sits indented 1.25rem; its trunk runs
   under the parent's key (x = 6px for a goal's 12px key), each branch
   gets an elbow at its own key's height (--gn-elbow-y), the last one a
   corner. A parent with branches draws the stub from its key down to its
   branch list (the head's / row's ::after). */
.gn-branches {
  margin: 0.25rem 0 0;
  padding: 0 0 0 1.25rem;
}
.gn-branch {
  --gn-trunk-x: calc(6px - 1.25rem);
  --gn-elbow-y: 0.9375rem;
  position: relative;
}
.gn-branch.gn-goal-group {
  --gn-elbow-y: calc(0.25rem + 0.875rem);
}
/* A sub-metric list hangs under a metric row's 10px key (row padding 0.375rem). */
.gn-metric .gn-branches {
  margin: 0;
}
.gn-metric .gn-branch {
  --gn-trunk-x: calc(0.375rem + 5px - 1.25rem);
}
.gn-branch::before,
.gn-branch::after,
.gn-goal-head.has-branches::after,
.gn-metric-row.has-branches::after {
  content: "";
  position: absolute;
  border-color: var(--gn-axis);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}
.gn-branch::before {
  left: var(--gn-trunk-x);
  top: 0;
  bottom: 0;
  border-left-width: 1px;
}
.gn-branch:last-child::before {
  bottom: auto;
  height: var(--gn-elbow-y);
}
.gn-branch::after {
  left: var(--gn-trunk-x);
  top: var(--gn-elbow-y);
  width: calc(-1 * var(--gn-trunk-x) - 2px);
  border-top-width: 1px;
}
.gn-goal-head.has-branches::after {
  left: 6px;
  top: calc(0.875rem + 4px);
  bottom: -0.25rem;
  border-left-width: 1px;
}
.gn-metric-row.has-branches::after {
  left: calc(0.375rem + 5px);
  top: calc(0.9375rem + 4px);
  bottom: 0;
  border-left-width: 1px;
}

/* Drag to reorder (lib/ordering.ts): a line where the row will land. */
.gn-goal-head[draggable="true"],
.gn-metric-row[draggable="true"] {
  cursor: grab;
}
.gn-goal-head[data-dragging],
.gn-metric-row[data-dragging] {
  opacity: 0.5;
}
.gn-goal-head[data-drop="before"],
.gn-metric-row[data-drop="before"] {
  box-shadow: inset 0 2px 0 var(--tblr-primary, #066fd1);
}
.gn-goal-head[data-drop="after"],
.gn-metric-row[data-drop="after"] {
  box-shadow: inset 0 -2px 0 var(--tblr-primary, #066fd1);
}

/* Fold/unfold chevron after a node's name. */
.gn-collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--gn-text-secondary);
  cursor: pointer;
}
.gn-collapse:hover {
  background: var(--tblr-bg-surface-secondary, #f6f8fb);
  color: var(--gn-text-primary);
}
.gn-collapse svg {
  width: 14px;
  height: 14px;
  transition: transform 0.15s;
}
.gn-collapse.is-collapsed svg {
  transform: rotate(-90deg);
}
.gn-goal-head > .gn-collapse {
  margin-top: 0.25rem;
}

/* Metric row: [key name] [current / target] [+] [eye]. */
.gn-metric-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  column-gap: 0.375rem;
  min-height: 1.875rem;
  padding-inline-start: 0.375rem;
  border-radius: 4px;
  font-size: 0.8125rem;
}
.gn-metric-row:hover {
  background: var(--tblr-bg-surface-secondary, #f6f8fb);
}
.gn-metric-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}
.gn-metric-label .gn-key {
  width: 10px;
}
.gn-metric-name {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gn-text-primary);
}
.gn-metric-value {
  font-weight: 600;
  color: var(--gn-text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.gn-metric-target {
  font-weight: 400;
  color: var(--gn-text-secondary);
}
.gn-metric-row.is-off .gn-metric-name,
.gn-metric-row.is-off .gn-metric-value,
.gn-metric-row.is-off .gn-metric-target {
  color: var(--gn-text-secondary);
  opacity: 0.55;
}
.gn-metric-empty {
  display: flex;
  align-items: center;
  min-height: 1.875rem;
  padding-inline-start: 0.375rem;
  font-size: 0.8125rem;
  color: var(--gn-text-secondary);
}

/* Row controls: compact icon buttons; a hidden (eye-off) toggle is muted. */
.gn-row-btn.btn-icon {
  width: 1.75rem;
  height: 1.75rem;
  min-height: 0;
  padding: 0;
}
/* Mouse clicks shouldn't leave Tabler's ghost-button focus fill behind -
   keyboard focus (focus-visible) keeps it. */
.gn-row-btn:focus:not(:focus-visible) {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
/* A row's "+" menu: fixed-positioned inline (see RowMenu) so the tree's
   scroll box can't clip it; right-aligned to the toggle. */
.gn-row-menu-list {
  min-width: 10rem;
  z-index: 1050;
}
.gn-eye.is-off {
  color: var(--gn-text-secondary);
  opacity: 0.7;
}
`;
