/** The check-in table's styles, rendered through React 19's `<style href precedence>` (no `.css` import - see AGENTS.md). */
export const TABLE_CSS = `.gn-table-wrap { overflow: auto; max-height: calc(100vh - 14rem); }
.gn-table { border-collapse: separate; border-spacing: 0; font-size: .85rem; min-width: 100%; }
.gn-table .gn-fill { width: 100%; padding: 0; }
.gn-table .gn-draft { position: sticky; right: 0; min-width: 15rem; box-shadow: inset 1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-table thead .gn-draft { z-index: 3; text-align: left; }
.gn-table tbody .gn-draft { z-index: 1; }
.gn-table tr.gn-goal-row .gn-draft { background: var(--tblr-bg-surface-secondary, #f6f8fb); }
.gn-table th, .gn-table td { padding: .35rem .6rem; white-space: nowrap; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); background: var(--tblr-bg-surface, #fff); }
.gn-table thead th { position: sticky; top: 0; z-index: 2; text-align: right; font-weight: 600; }
.gn-table .gn-sticky { position: sticky; left: 0; z-index: 1; text-align: left; min-width: 16rem; max-width: 22rem; box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-table thead .gn-sticky { z-index: 3; overflow: visible; }
.gn-table tbody .gn-sticky:has(.dropdown-menu.show), .gn-table tbody .gn-sticky:focus-within { z-index: 10; }
.gn-table td.gn-cell { text-align: right; font-variant-numeric: tabular-nums; }
.gn-table tr.gn-goal-row th, .gn-table tr.gn-goal-row td { font-weight: 600; background: var(--tblr-bg-surface-secondary, #f6f8fb); }
.gn-table .gn-sub { display: block; font-size: .7rem; color: var(--tblr-secondary, #667382); font-weight: 400; }
.gn-table tbody th[draggable="true"] { cursor: grab; }
.gn-table tbody tr[data-dragging] > * { opacity: .5; }
.gn-table tbody tr[data-drop="before"] > * { box-shadow: inset 0 2px 0 var(--tblr-primary, #066fd1); }
.gn-table tbody tr[data-drop="after"] > * { box-shadow: inset 0 -2px 0 var(--tblr-primary, #066fd1); }
.gn-table .gn-collapse { color: var(--tblr-secondary, #667382); flex-shrink: 0; }
.gn-table .gn-collapse-gap { display: inline-block; width: 1.25rem; flex-shrink: 0; }
.gn-table .gn-goal-tag { margin: 0 0 0 .4rem; border: 1px solid var(--tblr-border-color, #e6e7e9); color: var(--tblr-secondary, #667382); font-weight: 500; }
.gn-table .gn-target { color: var(--tblr-secondary, #667382); text-align: right; }
`;
