/** The team board's own styles (rendered through React 19's `<style href precedence>` - see AGENTS.md on CSS in modules). */
export const BOARD_CSS = `.gn-board-wrap { overflow-x: auto; }
.gn-history .gn-history-goal { font-weight: 600; }
.gn-history .gn-history-metric { font-weight: 400; }
.gn-history td.gn-num, .gn-history th.gn-num { text-align: right; }
.gn-history td.gn-period-edit { cursor: pointer; }
.gn-history td.gn-period-edit:hover, .gn-history td.gn-period-edit:focus-visible { box-shadow: inset 0 0 0 1px var(--tblr-primary, #066fd1); outline: none; }
.gn-history input.form-control { width: 6rem; text-align: right; }
.gn-period-tip { position: fixed; z-index: 1080; pointer-events: none; max-width: 280px; padding: .4rem .6rem; border-radius: 6px; font-size: .75rem; line-height: 1.45;
  background: var(--tblr-bg-surface, #fff); color: var(--tblr-body-color, #1d273b); border: 1px solid var(--tblr-border-color, #e6e7e9); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); }
.gn-period-tip > div:first-child { font-weight: 600; }
.gn-period-tip > div:last-child:not(:first-child) { color: var(--tblr-secondary, #667382); }
.gn-fold-btn { display: inline-flex; align-items: center; gap: .4rem; max-width: 100%; min-width: 0; font-weight: 500; }
.gn-board-card:fullscreen { background: var(--tblr-body-bg, #f6f8fb); padding: 1rem; overflow: auto; }
.gn-board-card:fullscreen .gn-board-wrap { overflow: auto; max-height: calc(100vh - 6.5rem); }
.gn-board { border-collapse: separate; border-spacing: 0; font-size: .85rem; min-width: 100%; }
.gn-board th, .gn-board td { padding: .35rem .55rem; white-space: nowrap; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); background: var(--tblr-bg-surface, #fff); vertical-align: top; }
.gn-board thead th { position: sticky; z-index: 2; font-weight: 600; text-align: left; transform: translateY(var(--gn-head-y, 0px)); }
.gn-board thead tr:first-child th { top: 0; }
.gn-board thead tr:nth-child(2) th { top: 2.1rem; font-weight: 500; }
.gn-board .gn-team { position: sticky; left: 0; z-index: 1; width: 1px; box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-board thead .gn-team { z-index: 3; }
.gn-board tr.gn-total > * { background: var(--tblr-bg-surface-secondary, #f6f8fb); font-weight: 600; }
.gn-board tr.gn-muted > * { color: var(--tblr-secondary, #667382); }
.gn-board tr.gn-group > * { background: var(--tblr-bg-surface-secondary, #f6f8fb); font-weight: 600; }
.gn-board .gn-pick { position: sticky; z-index: 1; width: 3rem; min-width: 3rem; max-width: 3rem; text-align: center; padding-left: .3rem; padding-right: .3rem; }
.gn-board .gn-total-line { margin-top: .3rem; padding-top: .2rem; border-top: 1px dashed var(--tblr-border-color, #e6e7e9); font-weight: 600; }
.gn-board .gn-pick-own { left: var(--gn-team-w, 0px); }
.gn-board .gn-pick-total { left: calc(var(--gn-team-w, 0px) + 3rem); box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-board.gn-picking .gn-team { box-shadow: none; }
.gn-board thead .gn-pick { z-index: 3; }
.gn-board thead th.gn-pick { text-align: center; font-size: .75rem; vertical-align: bottom; }
.gn-board .gn-pick .form-check-input { margin: 0; float: none; }
.gn-board .gn-board-goal { border-left: 2px solid var(--tblr-border-color, #e6e7e9); }
.gn-board .gn-head-btn { all: unset; cursor: pointer; }
.gn-board .gn-head-remove { all: unset; cursor: pointer; margin-left: .3rem; color: var(--tblr-secondary, #667382); opacity: .45; font-size: .8rem; line-height: 1; }
.gn-board th:hover .gn-head-remove, .gn-board .gn-head-remove:focus-visible { opacity: 1; }
.gn-board .gn-head-remove:hover { color: var(--tblr-danger, #d63939); }
.gn-board .gn-head-btn:hover, .gn-board .gn-head-btn:focus-visible { color: var(--tblr-primary, #066fd1); text-decoration: underline; }
.gn-board .gn-num { font-variant-numeric: tabular-nums; }
.gn-board .gn-update { min-width: 6.5rem; }
.gn-board th.gn-update { color: var(--tblr-secondary, #667382); font-weight: 500; }
.gn-board td.gn-update { font-variant-numeric: tabular-nums; }
.gn-board .gn-sub { display: block; font-size: .7rem; color: var(--tblr-secondary, #667382); font-weight: 400; }
.gn-board .gn-gap-neg { color: var(--tblr-danger, #d63939); }
.gn-board td.gn-cell { min-width: 9rem; }
.gn-board input.form-control { width: 6.5rem; display: inline-block; }
.gn-board input.gn-dirty { border-color: var(--tblr-primary, #066fd1); box-shadow: 0 0 0 1px var(--tblr-primary, #066fd1); }
.gn-board .gn-note { width: 9rem !important; margin-top: .2rem; }
.gn-board .gn-h-done { background: color-mix(in srgb, var(--tblr-success, #2fb344) 16%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-good { background: color-mix(in srgb, var(--tblr-success, #2fb344) 7%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-mid { background: color-mix(in srgb, var(--tblr-warning, #f76707) 9%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-low { background: color-mix(in srgb, var(--tblr-danger, #d63939) 8%, var(--tblr-bg-surface, #fff)); }
.gn-board tr.gn-total .gn-h-done, .gn-board tr.gn-total .gn-h-good, .gn-board tr.gn-total .gn-h-mid, .gn-board tr.gn-total .gn-h-low { font-weight: 600; }
.gn-board .gn-badge { font-size: .65rem; font-weight: 500; margin-left: .35rem; }
@media (max-width: 576px) { .gn-board .gn-team { min-width: 8rem; max-width: 10rem; white-space: normal; } }
.gn-board .gn-icon-btn { border: 0; background: none; padding: 0 .2rem; color: var(--tblr-secondary, #667382); cursor: pointer; }
`;
