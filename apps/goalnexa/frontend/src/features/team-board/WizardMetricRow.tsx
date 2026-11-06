import { Button, FormControl, FormLabel, FormSelect, type CrudField } from "platform-core";
import CheckInMomentField from "../../components/CheckInMomentField";
import type { RollupRule } from "../../api/teamBoard";
import type { TargetPer } from "../../api/metrics";
import {
  PER_ORDER,
  ROLLUP_LABELS,
  SNAP_TO_LABELS,
  TARGET_PER_LABELS,
  periodFits,
  type DraftMetric,
} from "./templateWizardModel";

export interface WizardMetricRowProps {
  /** The goal it's under (its key makes the inputs' ids; its title names the Remove button). */
  goal: { key: number; title: string };
  metric: DraftMetric;
  /** Its place under the goal (0-based). */
  index: number;
  onChange: (change: Partial<DraftMetric>) => void;
  onRemove: () => void;
  /** The template metric schema's moment fields (`snap_weekday`, `snap_time`, ...), by key; without them only the period is picked. */
  momentFields?: Partial<Record<string, CrudField<Record<string, unknown>>>>;
}

/**
 * One metric in the template wizard's Metrics step: name and unit, how a
 * check-in counts and how teams add up, a target per period (amounts only),
 * the check-in period (and its moment), the default start and target.
 */
function WizardMetricRow({ goal, metric, index: mi, onChange, onRemove, momentFields = {} }: WizardMetricRowProps) {
  const id = `tw-${goal.key}-${metric.key}`;
  // "Check-in period" offers only the periods that fit the target's. Which check-ins in it count
  // follows "Each check-in is": the last new value, or every amount added up.
  const snapField: CrudField<Record<string, unknown>> = {
    key: "snap_to",
    label: "Check-in period",
    type: "select",
    options: PER_ORDER.filter((per) => periodFits(per, metric.targetPer)).map((per) => ({
      value: per,
      label: SNAP_TO_LABELS[per],
    })),
  };
  return (
    <div className="row g-2 align-items-end mb-2 pb-2 border-bottom">
      <div className="col-md-4">
        <FormLabel htmlFor={`${id}-name`}>Metric</FormLabel>
        <FormControl id={`${id}-name`} value={metric.name} placeholder="Revenue"
          onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="col-md-2">
        <FormLabel htmlFor={`${id}-unit`}>Unit</FormLabel>
        <FormControl id={`${id}-unit`} value={metric.unit} placeholder="$"
          onChange={(e) => onChange({ unit: e.target.value })} />
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-agg`}>Each check-in is</FormLabel>
        <FormSelect id={`${id}-agg`} value={metric.aggregation}
          onChange={(e) => {
            const aggregation = e.target.value as DraftMetric["aggregation"];
            // A target per period is for amounts to add only.
            onChange(aggregation === "sum" ? { aggregation } : { aggregation, targetPer: "", progressBy: "total" });
          }}>
          <option value="latest">The new value</option>
          <option value="sum">An amount to add</option>
        </FormSelect>
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-rollup`}>Totals</FormLabel>
        <FormSelect id={`${id}-rollup`} value={metric.rollup}
          onChange={(e) => onChange({ rollup: e.target.value as RollupRule })}>
          {(Object.keys(ROLLUP_LABELS) as RollupRule[])
            .filter((r) => !(r === "sum" && metric.progressBy === "hit_rate" && metric.targetPer))
            .map((r) => (
              <option key={r} value={r}>{ROLLUP_LABELS[r]}</option>
            ))}
        </FormSelect>
      </div>
      {metric.aggregation === "sum" && (
        <>
          <div className="col-md-4">
            <FormLabel htmlFor={`${id}-per`}>Target is for</FormLabel>
            <FormSelect id={`${id}-per`} value={metric.targetPer}
              onChange={(e) => {
                const targetPer = e.target.value as TargetPer;
                onChange({ targetPer, ...(periodFits(metric.snapTo, targetPer) ? {} : { snapTo: "" as TargetPer }) });
              }}>
              {(Object.keys(TARGET_PER_LABELS) as TargetPer[]).map((per) => (
                <option key={per} value={per}>{TARGET_PER_LABELS[per]}</option>
              ))}
            </FormSelect>
          </div>
          {(metric.targetPer === "day" || metric.targetPer === "week") && (
            <div className="col-md-4">
              <FormLabel htmlFor={`${id}-days`}>Counts</FormLabel>
              <FormSelect id={`${id}-days`} value={metric.countDays}
                onChange={(e) => onChange({ countDays: e.target.value as DraftMetric["countDays"] })}>
                <option value="all">Every day</option>
                <option value="weekdays">Weekdays only</option>
              </FormSelect>
            </div>
          )}
          {metric.targetPer && (
            <div className="col-md-4">
              <FormLabel htmlFor={`${id}-by`}>Progress is</FormLabel>
              <FormSelect id={`${id}-by`} value={metric.progressBy}
                onChange={(e) => {
                  const progressBy = e.target.value as DraftMetric["progressBy"];
                  onChange({
                    progressBy,
                    ...(progressBy === "hit_rate" && metric.rollup === "sum" ? { rollup: "avg" as RollupRule } : {}),
                  });
                }}>
                <option value="total">The total</option>
                <option value="hit_rate">How often it's hit</option>
              </FormSelect>
            </div>
          )}
        </>
      )}
      <div className="col-md-4">
        <CheckInMomentField
          id={`${id}-snap`}
          field={snapField}
          fields={momentFields}
          values={{ snap_to: metric.snapTo, ...metric.moment }}
          onChange={(key, value) =>
            onChange(key === "snap_to" ? { snapTo: value as TargetPer } : { moment: { ...metric.moment, [key]: value } })
          }
        />
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-base`}>Start</FormLabel>
        <FormControl id={`${id}-base`} inputMode="decimal" value={metric.base}
          onChange={(e) => onChange({ base: e.target.value })} />
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-target`}>
          Default target{metric.targetPer ? ` / ${metric.targetPer}` : ""}
        </FormLabel>
        <FormControl id={`${id}-target`} inputMode="decimal" value={metric.target} placeholder="Each team's own"
          onChange={(e) => onChange({ target: e.target.value })} />
      </div>
      <div className="col-md-auto ms-auto">
        <Button variant="danger" outline aria-label={`Remove metric ${mi + 1} of ${goal.title}`}
          onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export default WizardMetricRow;
