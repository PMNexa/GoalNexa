import { useEffect, useRef, useState } from "react";

export interface GoalPickerOption {
  id: string;
  title: string;
  /** Nesting depth in the goal tree (0 = top-level), for the indent. */
  depth: number;
}

export interface GoalPickerProps {
  /** Every goal, in tree order. */
  options: GoalPickerOption[];
  /** Picked goal ids; empty = all goals. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

const PICKER_CSS = `.gn-goal-picker { position: relative; }
.gn-goal-picker .gn-goal-picker-menu { position: absolute; top: calc(100% + .25rem); left: 0; z-index: 20; min-width: 16rem; max-width: 24rem; max-height: 22rem; overflow: auto; padding: .35rem 0; background: var(--tblr-bg-surface, #fff); border: 1px solid var(--tblr-border-color, #e6e7e9); border-radius: 4px; box-shadow: 0 .5rem 1rem rgba(0, 0, 0, .1); }
.gn-goal-picker label { display: flex; align-items: flex-start; gap: .5rem; padding: .3rem .75rem; margin: 0; cursor: pointer; font-size: .85rem; }
.gn-goal-picker label:hover { background: var(--tblr-bg-surface-secondary, #f6f8fb); }
.gn-goal-picker .form-check-input { margin: .15rem 0 0; flex-shrink: 0; }
.gn-goal-picker .gn-goal-picker-head { display: flex; justify-content: space-between; align-items: center; padding: .15rem .75rem .35rem; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); margin-bottom: .25rem; font-size: .75rem; color: var(--tblr-secondary, #667382); }
`;

/**
 * Which goals a view shows: a button with a checkbox list of goals
 * (indented as in the goal tree). Nothing ticked means every goal; a ticked
 * goal brings its sub-goals with it.
 */
function GoalPicker({ options, selected, onChange, disabled }: GoalPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const picked = options.filter((option) => selected.has(option.id));

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const label =
    picked.length === 0
      ? "All goals"
      : picked.length === 1
        ? picked[0].title
        : `${picked.length} goals`;

  return (
    <div className="gn-goal-picker" ref={root}>
      <style href="gn-goal-picker" precedence="default">
        {PICKER_CSS}
      </style>
      <button
        type="button"
        className="form-select form-select-sm text-start text-truncate"
        style={{ maxWidth: "16rem" }}
        aria-haspopup="true"
        aria-expanded={open}
        title={picked.map((option) => option.title).join("\n") || "All goals"}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div className="gn-goal-picker-menu" role="group" aria-label="Goals to show">
          <div className="gn-goal-picker-head">
            <span>
              {picked.length ? `${picked.length} of ${options.length}` : "Showing all"}
            </span>
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              disabled={picked.length === 0}
              onClick={() => onChange(new Set())}
            >
              Show all
            </button>
          </div>
          {options.length === 0 ? (
            <div className="text-secondary small px-3 py-1">No goals yet.</div>
          ) : (
            options.map((option) => (
              <label
                key={option.id}
                style={{ paddingLeft: `${0.75 + option.depth * 1.1}rem` }}
              >
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selected.has(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span>{option.title}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default GoalPicker;
