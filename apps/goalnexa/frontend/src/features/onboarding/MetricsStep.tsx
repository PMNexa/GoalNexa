import { Button, FormControl, Icon, useT } from "platform-core";
import messages from "./messages";
import { newMetric, type GoalDraft, type MetricDraft } from "./onboardingDrafts";

export interface MetricsStepProps {
  goals: GoalDraft[];
  /** Draft keys of metrics already created (a failed create's retry) - locked. */
  locked: { has: (key: number) => boolean };
  onUpdateGoal: (key: number, patch: Partial<GoalDraft>) => void;
  onUpdateMetric: (goalKey: number, metricKey: number, patch: Partial<MetricDraft>) => void;
}

/** The website path's metrics: per goal, each metric's name, unit, start and target. */
function MetricsStep({ goals, locked, onUpdateGoal, onUpdateMetric }: MetricsStepProps) {
  const t = useT(messages);
  return (
    <div>
      <h3 className="card-title">{t("metricsTitle")}</h3>
      <p className="text-secondary">
        {t("metricsHint")}
      </p>
      {goals.map((goal) => (
        <fieldset key={goal.key} className="mb-4">
          <legend className="fs-4 fw-bold mb-2">{goal.title}</legend>
          <div className="row g-2 text-secondary small d-none d-md-flex mb-1">
            <div className="col">{t("metric")}</div>
            <div className="col-2">{t("unit")}</div>
            <div className="col-2">{t("start")}</div>
            <div className="col-2">{t("target")}</div>
            <div className="col-auto" style={{ width: "2.5rem" }} />
          </div>
          {goal.metrics.map((metric) => {
            const isLocked = locked.has(metric.key);
            const id = `onboarding-metric-${metric.key}`;
            return (
              <div key={metric.key} className="row g-2 align-items-center mb-3">
                <div className="col-12 col-md">
                  <label className="visually-hidden" htmlFor={`${id}-name`}>{t("metricName")}</label>
                  <FormControl
                    id={`${id}-name`}
                    placeholder={t("metricPlaceholder")}
                    value={metric.name}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { name: event.target.value })}
                  />
                </div>
                <div className="col-4 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-unit`}>{t("unit")}</label>
                  <FormControl
                    id={`${id}-unit`}
                    placeholder={t("unitPlaceholder")}
                    value={metric.unit}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { unit: event.target.value })}
                  />
                </div>
                <div className="col-3 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-base`}>{t("startValue")}</label>
                  <FormControl
                    id={`${id}-base`}
                    type="number"
                    step="any"
                    placeholder={t("startPlaceholder")}
                    value={metric.base}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { base: event.target.value })}
                  />
                </div>
                <div className="col-3 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-target`}>{t("targetValue")}</label>
                  <FormControl
                    id={`${id}-target`}
                    type="number"
                    step="any"
                    placeholder={t("targetPlaceholder")}
                    value={metric.target}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { target: event.target.value })}
                  />
                </div>
                <div className="col-auto">
                  <Button
                    icon
                    outline
                    variant="secondary"
                    aria-label={metric.name.trim() ? t("removeMetricNamed", { name: metric.name }) : t("removeMetric")}
                    disabled={goal.metrics.length === 1 || isLocked}
                    onClick={() => onUpdateGoal(goal.key, { metrics: goal.metrics.filter((m) => m.key !== metric.key) })}
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
                <div className="col-12">
                  <label className="visually-hidden" htmlFor={`${id}-desc`}>{t("metricDescription")}</label>
                  <FormControl
                    id={`${id}-desc`}
                    placeholder={t("metricDescriptionPlaceholder")}
                    value={metric.description}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { description: event.target.value })}
                  />
                </div>
              </div>
            );
          })}
          <Button
            variant="link"
            className="px-0"
            onClick={() => onUpdateGoal(goal.key, { metrics: [...goal.metrics, newMetric()] })}
          >
            <Icon name="plus" /> {t("addMetric")}
          </Button>
        </fieldset>
      ))}
    </div>
  );
}

export default MetricsStep;
