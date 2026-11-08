import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Button, formatDateTime, formatNumber, formatTime, FormControl, FormLabel, FormSelect, Modal, useLocale, useT, type Locale } from "platform-core";
import { apiRequest } from "../../api/client";
import type { CheckIn } from "../../api/checkIns";
import type { Metric } from "../../api/metrics";
import { countedPer, midPeriod, momentStart, nextMomentStart, recentPeriods, type Snap } from "../../lib/periods";
import messages from "./CheckInModal.messages";

const TIME_OF_DAY: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

/**
 * The check-in that counts for the period `t` falls in (one reading per
 * period): the latest of that period, or null. `undefined` while loading.
 */
function usePeriodCheckIn(
  accessToken: string,
  metric: Metric,
  per: Snap | null,
  t: number,
  onLoaded: (checkIn: CheckIn | null) => void,
): CheckIn | null | undefined {
  const loadedRef = useRef(onLoaded);
  useEffect(() => {
    loadedRef.current = onLoaded;
  });
  // The metric's own period (P-93): from one of its moments to the next.
  const start = per ? momentStart(t, per, metric) : 0;
  const [found, setFound] = useState<{ start: number; checkIn: CheckIn | null } | null>(null);
  useEffect(() => {
    if (!per) return;
    let live = true;
    apiRequest<{ items: CheckIn[] }>("/api/v1/check-ins", accessToken, {
      params: {
        "filter{metric}": metric.id,
        "filter{checked_in_at.gte}": new Date(start).toISOString(),
        "filter{checked_in_at.lt}": new Date(nextMomentStart(start, per, metric)).toISOString(),
        sort: "-checked_in_at",
        page_size: 1,
      },
    })
      .then((page) => {
        if (!live) return;
        setFound({ start, checkIn: page.items[0] ?? null });
        loadedRef.current(page.items[0] ?? null);
      })
      .catch(() => live && setFound({ start, checkIn: null }));
    return () => {
      live = false;
    };
  }, [accessToken, metric, per, start]);
  if (!per) return null;
  return found && found.start === start ? found.checkIn : undefined;
}

export interface CheckInModalProps {
  accessToken: string;
  /** The metric being checked in; `null` = closed. */
  metric: Metric | null;
  goalTitle?: string;
  onSaved: () => void;
  onClose: () => void;
}

function formatAmount(value: string, locale: Locale): string {
  return formatNumber(Number(value), { maximumFractionDigits: 2 }, locale);
}

/**
 * Log a check-in for one metric from the dashboard, in platform-core's
 * `Modal`. For a `sum` metric the value is an amount to add, and the form
 * says so (with the total it makes). A blank time is left out so the server default (now) applies. The form's
 * fields reset each time it opens (`key` on the inner form).
 */
function CheckInModal({ accessToken, metric, goalTitle, onSaved, onClose }: CheckInModalProps) {
  const t = useT(messages);
  return (
    <Modal
      open={metric !== null}
      onClose={onClose}
      size="sm"
      title={metric ? t("title", { name: metric.name }) : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary" form="dashboard-check-in-form">
            {t("save")}
          </Button>
        </>
      }
    >
      {metric && (
        <CheckInForm key={metric.id} accessToken={accessToken} metric={metric} goalTitle={goalTitle} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function CheckInForm({
  accessToken,
  metric,
  goalTitle,
  onSaved,
}: {
  accessToken: string;
  metric: Metric;
  goalTitle?: string;
  onSaved: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const amount = (v: string) => formatAmount(v, locale);
  const [value, setValue] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adds = metric.aggregation === "sum";
  // The period's last check-in counts (one reading per period, or a new value for a period): this one replaces the earlier.
  const per = countedPer(metric);
  // Check-ins for a whole period - the metric's own, or its goal's.
  const snap = metric.snap_period ?? "";
  const [openedAt] = useState(() => Date.now());
  const at = when ? new Date(when).getTime() : openedAt;
  // The first period's check-in fills the field in, if it's still empty.
  const prefilled = useRef(false);
  const existing = usePeriodCheckIn(accessToken, metric, per, at, (checkIn) => {
    if (checkIn && !prefilled.current) setValue((current) => (current === "" ? String(Number(checkIn.value)) : current));
    prefilled.current = true;
  });
  const periodWord = per ? t(when ? `that_${per}` : `this_${per}`) : "";
  // A later check-in in the same period keeps counting - this one would be replaced at once.
  // With a frequency, both land on their period's opening moment - the same one when in the same period.
  const existingAt = existing ? Date.parse(existing.checked_in_at) : 0;
  const later = !!existing && existingAt > at && !(snap && momentStart(existingAt, snap, metric) === momentStart(at, snap, metric));
  const replacing = !!existing && !later;
  const newTotal =
    value !== "" && Number.isFinite(Number(value))
      ? Number(metric.current_value) + Number(value) - (replacing && when === "" ? Number(existing.value) : 0)
      : null;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<CheckIn>("/api/v1/check-ins", accessToken, {
        method: "POST",
        data: {
          metric: metric.id,
          value: Number(value),
          note,
          ...(when ? { checked_in_at: new Date(when).toISOString() } : {}),
        },
      });
      onSaved();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
      setSubmitting(false);
    }
  }

  return (
    <form id="dashboard-check-in-form" onSubmit={handleSubmit}>
      <p className="text-secondary mb-3">
        {goalTitle && <>{goalTitle} · </>}
        {t("now", { current: amount(metric.current_value), target: amount(metric.target_value), unit: metric.unit })}
        {Number(metric.base_value) !== 0 && <> · {t("startedAt", { base: amount(metric.base_value) })}</>}
      </p>
      <div className="mb-3">
        <FormLabel htmlFor="dashboard-check-in-value" required>
          {adds ? (per ? t("totalSoFar", { period: periodWord }) : t("amountToAdd")) : t("value")}
          {metric.unit ? ` (${metric.unit})` : ""}
        </FormLabel>
        <FormControl
          id="dashboard-check-in-value"
          type="number"
          step="any"
          required
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {existing && (
          <small className="form-hint">
            {later
              ? t("later", {
                  value: amount(existing.value),
                  when: formatDateTime(existing.checked_in_at, SHORT_DATE, locale),
                  period: periodWord,
                })
              : t("replaces", {
                  period: periodWord,
                  value: amount(existing.value),
                  // A check-in for a period has no time of its own - it's the period's first day.
                  time: snap
                    ? undefined
                    : when
                      ? formatDateTime(existing.checked_in_at, SHORT_DATE, locale)
                      : formatTime(existing.checked_in_at, TIME_OF_DAY, locale),
                })}
            {!later && adds && newTotal !== null && when === "" ? t("newTotal", { total: amount(String(newTotal)) }) : ""}
            {!later ? "." : ""}
          </small>
        )}
        {adds && !existing && (
          <small className="form-hint">
            {per ? t("totalHint", { period: periodWord }) : t("addsToTotal")}
            {newTotal !== null && when === "" ? t("newTotal", { total: amount(String(newTotal)) }) : ""}.
          </small>
        )}
      </div>
      {snap ? (
        // A frequency: pick the period (the server moves the time to the moment that opens it).
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-check-in-when">{t("for")}</FormLabel>
          <FormSelect id="dashboard-check-in-when" value={when} onChange={(event) => setWhen(event.target.value)}>
            {recentPeriods(snap, openedAt, 12, locale, metric).map((period, index) => (
              <option key={period.start} value={index === 0 ? "" : new Date(midPeriod(period.start, snap as Snap, metric)).toISOString()}>
                {index === 0 ? `${t(`this_${snap as Snap}`).replace(/^./, (c) => c.toUpperCase())} (${period.label})` : period.label}
              </option>
            ))}
          </FormSelect>
        </div>
      ) : (
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-check-in-when">{t("when")}</FormLabel>
          <FormControl id="dashboard-check-in-when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          <small className="form-hint">{t("whenHint")}</small>
        </div>
      )}
      <div>
        <FormLabel htmlFor="dashboard-check-in-note">{t("note")}</FormLabel>
        <FormControl id="dashboard-check-in-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {error && (
        <p className="text-danger mt-3 mb-0" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default CheckInModal;
