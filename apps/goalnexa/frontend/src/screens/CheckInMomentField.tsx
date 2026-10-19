import { useEffect, useRef, useState } from "react";
import { FormLabel, type CrudField, type FieldWidgetProps } from "platform-core";

const CSS = `.gn-moment .gn-mo-anchor { position: relative; }
.gn-moment .gn-mo-menu { position: absolute; top: calc(100% + .25rem); left: 0; right: 0; max-width: 26rem; z-index: 30; padding: .75rem; background: var(--tblr-bg-surface, #fff); border: 1px solid var(--tblr-border-color, #e6e7e9); border-radius: 4px; box-shadow: 0 .5rem 1rem rgba(0, 0, 0, .1); }
.gn-moment .gn-mo-step { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--tblr-secondary, #667382); margin: 0 0 .35rem; }
.gn-moment .gn-mo-step:not(:first-child) { margin-top: .75rem; }
.gn-moment .gn-mo-grid { display: grid; gap: 3px; }
.gn-moment .gn-mo-opt { border: 1px solid var(--tblr-border-color, #e6e7e9); background: transparent; border-radius: 3px; padding: .3rem .4rem; font-size: .8rem; color: inherit; text-align: center; font-variant-numeric: tabular-nums; }
.gn-moment .gn-mo-opt:hover { background: var(--tblr-bg-surface-secondary, #f1f3f6); }
.gn-moment .gn-mo-opt[aria-pressed="true"], .gn-moment .gn-mo-opt[aria-pressed="true"]:hover { background: var(--tblr-primary, #066fd1); border-color: var(--tblr-primary, #066fd1); color: #fff; }
.gn-moment .gn-mo-list .gn-mo-opt { text-align: start; }
.gn-moment .gn-mo-hint { font-size: .75rem; color: var(--tblr-secondary, #667382); margin-top: .25rem; }
.gn-moment .gn-mo-foot { display: flex; justify-content: flex-end; margin-top: .75rem; }
`;

/** The periods with a moment; any other `snap_to` value (inherited, any time) has none. */
const PERIODS = ["day", "week", "month", "quarter", "year"];
const EACH: Record<string, string> = { day: "Each day", week: "Each week", month: "Each month", quarter: "Each quarter", year: "Each year" };
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Values = Record<string, unknown>;

/** The value shown for `key`: the form's, else the field's default, else `fallback`. */
function valueOf(values: Values, field: CrudField<Values> | undefined, key: string, fallback: unknown): unknown {
  const value = values[key];
  if (value !== undefined && value !== null) return value;
  return field?.defaultValue ?? fallback;
}

const same = (a: unknown, b: unknown) => String(a) === String(b);

function optionLabel(field: CrudField<Values> | undefined, value: unknown): string {
  return field?.options?.find((option) => same(option.value, value))?.label ?? String(value);
}

/**
 * "Check-ins are for" as one picker (layout widget "check-in-moment"): a
 * button with the setting in words, opening a menu where the period is
 * picked first, then - for a period - the moment in it (weekday, month of
 * the quarter, month, day, time) and whether it's due then. Values are the
 * schema's own (`snap_to` and the `SnapMoment` fields), sent as picked.
 */
export default function CheckInMomentField({ id, field, fields, values, onChange, errors }: FieldWidgetProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  // A template's copy (or a team total) takes it from the template's metrics - shown, not edited.
  const locked = Boolean(values.template_goal || values.template_metric || values.is_rollup);
  const per = String(valueOf(values, field, "snap_to", ""));
  const hasMoment = PERIODS.includes(per);
  const weekday = valueOf(values, fields.snap_weekday, "snap_weekday", 1);
  const quarterMonth = valueOf(values, fields.snap_quarter_month, "snap_quarter_month", 1);
  const month = valueOf(values, fields.snap_month, "snap_month", 1);
  const day = Number(valueOf(values, fields.snap_day, "snap_day", 1));
  const time = String(valueOf(values, fields.snap_time, "snap_time", "00:00"));
  const due = same(valueOf(values, fields.snap_due, "snap_due", true), true);
  const set = onChange;

  function summary(): string {
    if (!hasMoment) return optionLabel(field, per);
    const parts: string[] = [];
    if (per === "week" && fields.snap_weekday) parts.push(optionLabel(fields.snap_weekday, weekday));
    if (per === "quarter" && fields.snap_quarter_month) parts.push(optionLabel(fields.snap_quarter_month, quarterMonth).replace(/ \(.*\)$/, ""));
    if (per === "year" && fields.snap_month) parts.push(`${optionLabel(fields.snap_month, month)} ${day}`);
    else if ((per === "month" || per === "quarter") && fields.snap_day) parts.push(`day ${day}`);
    if (fields.snap_time) parts.push(time);
    const moment = parts.join(", ");
    return `${EACH[per]}${moment ? ` · ${moment}` : ""}${fields.snap_due && due ? " · due then" : ""}`;
  }

  function pickPer(value: unknown) {
    set("snap_to", value);
    if (!PERIODS.includes(String(value))) setOpen(false);
  }

  function choice(key: string, current: unknown, columns: number, short?: (label: string) => string) {
    const options = fields[key]?.options ?? [];
    return (
      <div className="gn-mo-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className="gn-mo-opt"
            aria-pressed={same(option.value, current)}
            title={option.label}
            onClick={() => set(key, option.value)}
          >
            {short ? short(option.label) : option.label}
          </button>
        ))}
      </div>
    );
  }

  const refused = [field.key, ...Object.keys(fields)].flatMap((key) => errors?.[key] ?? []);

  return (
    <div className="gn-moment">
      <style href="gn-moment" precedence="default">
        {CSS}
      </style>
      <FormLabel htmlFor={id} required={field.required}>
        {field.label}
      </FormLabel>
      <div className="gn-mo-anchor" ref={root}>
        <button
          id={id}
          type="button"
          className="form-select form-select-sm text-start text-truncate"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={locked}
          onClick={() => setOpen((v) => !v)}
        >
          {summary()}
        </button>
        {open && (
          <div className="gn-mo-menu" role="dialog" aria-label={String(field.label)}>
            <div className="gn-mo-step">For</div>
            <div className="gn-mo-grid gn-mo-list" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {field.options?.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  className="gn-mo-opt"
                  aria-pressed={same(option.value, per)}
                  style={PERIODS.includes(String(option.value)) ? undefined : { gridColumn: "1 / -1" }}
                  onClick={() => pickPer(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {hasMoment && (
              <>
                {per === "week" && fields.snap_weekday && (
                  <>
                    <div className="gn-mo-step">Day of the week</div>
                    {choice("snap_weekday", weekday, 7, (label) => label.slice(0, 3))}
                  </>
                )}
                {per === "quarter" && fields.snap_quarter_month && (
                  <>
                    <div className="gn-mo-step">Month of the quarter</div>
                    {choice("snap_quarter_month", quarterMonth, 3, (label) => label.replace(/ month.*$/, ""))}
                    <div className="gn-mo-hint">{optionLabel(fields.snap_quarter_month, quarterMonth)}</div>
                  </>
                )}
                {per === "year" && fields.snap_month && (
                  <>
                    <div className="gn-mo-step">Month</div>
                    {choice("snap_month", month, 6, (label) => label.slice(0, 3))}
                  </>
                )}
                {["month", "quarter", "year"].includes(per) && fields.snap_day && (
                  <>
                    <div className="gn-mo-step">Day of the month</div>
                    <div className="gn-mo-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                      {DAYS.map((d) => (
                        <button key={d} type="button" className="gn-mo-opt" aria-pressed={d === day} onClick={() => set("snap_day", d)}>
                          {d}
                        </button>
                      ))}
                    </div>
                    {day > 28 && <div className="gn-mo-hint">A shorter month uses its last day.</div>}
                  </>
                )}
                {fields.snap_time && (
                  <>
                    <label className="gn-mo-step d-block" htmlFor={`${id}-time`}>Time</label>
                    <select
                      id={`${id}-time`}
                      className="form-select form-select-sm"
                      value={time}
                      onChange={(event) => set("snap_time", event.target.value)}
                    >
                      {fields.snap_time.options?.map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {fields.snap_due && (
                  <label className="form-check mt-3 mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={due}
                      onChange={(event) => set("snap_due", event.target.checked)}
                    />
                    <span className="form-check-label">Due at that moment - flagged and reminded when it passes</span>
                  </label>
                )}
                <div className="gn-mo-foot">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {locked ? (
        <small className="form-hint">
          {values.template_metric
            ? "Set by the goal template - change it on its metric there (Goal templates)."
            : "Set on each metric of the goal template - change it there (Goal templates)."}
        </small>
      ) : (
        field.helpText && <small className="form-hint">{field.helpText}</small>
      )}
      {refused.length > 0 && <div className="invalid-feedback d-block">{refused.join(" ")}</div>}
    </div>
  );
}
