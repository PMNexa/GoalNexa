import { Button, FormControl, FormLabel, FormSelect, useT, type CrudField } from "platform-core";
import CheckInMomentField from "../../components/CheckInMomentField";
import type { RollupRule } from "../../api/teamBoard";
import type { TargetPer } from "../../api/metrics";
import {
  PER_ORDER,
  ROLLUP_RULES,
  periodFits,
  rollupLabel,
  snapToLabel,
  targetPerLabel,
  type DraftMetric,
} from "./templateWizardModel";
import messages from "./wizardMessages";

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
  const t = useT(messages);
  const id = `tw-${goal.key}-${metric.key}`;
  // "Check-in period" offers only the periods that fit the target's. Which check-ins in it count
  // follows "Each check-in is": the last new value, or every amount added up.
  const snapField: CrudField<Record<string, unknown>> = {
    key: "snap_to",
    label: t("checkInPeriod"),
    type: "select",
    options: PER_ORDER.filter((per) => periodFits(per, metric.targetPer)).map((per) => ({
      value: per,
      label: snapToLabel(per),
    })),
  };
  return (
    <div className="row g-2 align-items-end mb-2 pb-2 border-bottom">
      <div className="col-md-4">
        <FormLabel htmlFor={`${id}-name`}>{t("metric")}</FormLabel>
        <FormControl id={`${id}-name`} value={metric.name} placeholder={t("metricPlaceholder")}
          onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="col-md-2">
        <FormLabel htmlFor={`${id}-unit`}>{t("unit")}</FormLabel>
        <FormControl id={`${id}-unit`} value={metric.unit} placeholder="$"
          onChange={(e) => onChange({ unit: e.target.value })} />
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-agg`}>{t("eachCheckInIs")}</FormLabel>
        <FormSelect id={`${id}-agg`} value={metric.aggregation}
          onChange={(e) => {
            const aggregation = e.target.value as DraftMetric["aggregation"];
            // A target per period is for amounts to add only.
            onChange(aggregation === "sum" ? { aggregation } : { aggregation, targetPer: "", progressBy: "total" });
          }}>
          <option value="latest">{t("theNewValue")}</option>
          <option value="sum">{t("anAmountToAdd")}</option>
        </FormSelect>
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-rollup`}>{t("totals")}</FormLabel>
        <FormSelect id={`${id}-rollup`} value={metric.rollup}
          onChange={(e) => onChange({ rollup: e.target.value as RollupRule })}>
          {ROLLUP_RULES
            .filter((r) => !(r === "sum" && metric.progressBy === "hit_rate" && metric.targetPer))
            .map((r) => (
              <option key={r} value={r}>{rollupLabel(r)}</option>
            ))}
        </FormSelect>
      </div>
      {metric.aggregation === "sum" && (
        <>
          <div className="col-md-4">
            <FormLabel htmlFor={`${id}-per`}>{t("targetIsFor")}</FormLabel>
            <FormSelect id={`${id}-per`} value={metric.targetPer}
              onChange={(e) => {
                const targetPer = e.target.value as TargetPer;
                onChange({ targetPer, ...(periodFits(metric.snapTo, targetPer) ? {} : { snapTo: "" as TargetPer }) });
              }}>
              {PER_ORDER.map((per) => (
                <option key={per} value={per}>{targetPerLabel(per)}</option>
              ))}
            </FormSelect>
          </div>
          {(metric.targetPer === "day" || metric.targetPer === "week") && (
            <div className="col-md-4">
              <FormLabel htmlFor={`${id}-days`}>{t("counts")}</FormLabel>
              <FormSelect id={`${id}-days`} value={metric.countDays}
                onChange={(e) => onChange({ countDays: e.target.value as DraftMetric["countDays"] })}>
                <option value="all">{t("everyDay")}</option>
                <option value="weekdays">{t("weekdaysOnly")}</option>
              </FormSelect>
            </div>
          )}
          {metric.targetPer && (
            <div className="col-md-4">
              <FormLabel htmlFor={`${id}-by`}>{t("progressIs")}</FormLabel>
              <FormSelect id={`${id}-by`} value={metric.progressBy}
                onChange={(e) => {
                  const progressBy = e.target.value as DraftMetric["progressBy"];
                  onChange({
                    progressBy,
                    ...(progressBy === "hit_rate" && metric.rollup === "sum" ? { rollup: "avg" as RollupRule } : {}),
                  });
                }}>
                <option value="total">{t("theTotal")}</option>
                <option value="hit_rate">{t("howOftenHit")}</option>
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
        <FormLabel htmlFor={`${id}-base`}>{t("start")}</FormLabel>
        <FormControl id={`${id}-base`} inputMode="decimal" value={metric.base}
          onChange={(e) => onChange({ base: e.target.value })} />
      </div>
      <div className="col-md-3">
        <FormLabel htmlFor={`${id}-target`}>
          {metric.targetPer ? t(`defaultTargetPer_${metric.targetPer}`) : t("defaultTarget")}
        </FormLabel>
        <FormControl id={`${id}-target`} inputMode="decimal" value={metric.target} placeholder={t("eachTeamsOwn")}
          onChange={(e) => onChange({ target: e.target.value })} />
      </div>
      <div className="col-md-auto ms-auto">
        <Button variant="danger" outline aria-label={t("removeMetricAria", { n: mi + 1, goal: goal.title })}
          onClick={onRemove}>
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}

export default WizardMetricRow;
