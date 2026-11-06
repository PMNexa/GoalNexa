import { useEffect, useState, type SubmitEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, formatDateTime, FormLabel, useLocale, useT } from "platform-core";
import { errorMessage } from "../../api/goalMembers";
import {
  fetchDueMetrics,
  fetchReminderSettings,
  saveReminderSettings,
  sendTestReminder,
  type DigestFrequency,
  type DueMetric,
  type ReminderSettings,
  type ReminderSettingsInput,
} from "../../api/reminders";
import messages from "./RemindersScreen.messages";

export interface RemindersScreenProps {
  accessToken: string;
}

const DUE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

const WEEKDAYS = ["onDay0", "onDay1", "onDay2", "onDay3", "onDay4", "onDay5", "onDay6"] as const;

/** The browser's IANA time zone - digests go out at the chosen hour there. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formFrom(row: ReminderSettings): ReminderSettingsInput {
  const {
    allowed_schemes: _schemes,
    email_available: _available,
    push_available: _pushAvailable,
    push_devices: _devices,
    ...form
  } = row;
  return form;
}

const EXAMPLES = [
  ["Email", "mailtos://user:app-password@gmail.com"],
  ["ntfy", "ntfys://ntfy.sh/my-goalnexa-topic"],
  ["Telegram", "tgram://bot-token/chat-id"],
  ["Slack", "slack://TokenA/TokenB/TokenC/#channel"],
  ["Discord", "discord://webhook-id/webhook-token"],
  ["webhook", "json://example.com/hooks/goalnexa"],
] as const;

/**
 * Check-in reminders: where the signed-in user's reminders go (Apprise
 * URLs - email, ntfy, Telegram, Slack, Discord, webhooks, ...), their goals
 * digest (daily/weekly, at a local hour - the browser's time zone is saved
 * with it), a test message, and which of their metrics are due right now. A metric gets a
 * schedule from its own "Check in every" field; the server's scheduler
 * (`manage.py goalnexa_jobs`) sends one message per run listing a goal
 * owner's overdue metrics, once per due date. Self-contained like every
 * screen here - `accessToken` in, no router dependency.
 */
function RemindersScreen({ accessToken }: RemindersScreenProps) {
  const t = useT(messages);
  const locale = useLocale();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [form, setForm] = useState<ReminderSettingsInput | null>(null);
  const [due, setDue] = useState<{ items: DueMetric[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReminderSettings(accessToken)
      .then((row) => {
        if (cancelled) return;
        setSettings(row);
        setForm(formFrom(row));
      })
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    fetchDueMetrics(accessToken)
      .then((page) => !cancelled && setDue(page))
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await run();
      setNotice(done);
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    void act(async () => {
      const saved = await saveReminderSettings(accessToken, { ...form, timezone: browserTimeZone() });
      setSettings(saved);
      setForm(formFrom(saved));
    }, t("saved"));
  }

  function update<K extends keyof ReminderSettingsInput>(key: K, value: ReminderSettingsInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const dirty =
    settings !== null &&
    form !== null &&
    (Object.keys(form) as (keyof ReminderSettingsInput)[]).some((key) => key !== "timezone" && form[key] !== settings[key]);
  const zoneChanged = settings !== null && (settings.urls !== "" || settings.email || settings.push_devices > 0) && settings.timezone !== browserTimeZone();

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-7">
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-secondary">
              {t.rich("intro", {})}
            </p>
            {settings === null || form === null ? (
              !error && <div className="text-secondary">{t("loading")}</div>
            ) : (
              <form id="reminder-settings-form" onSubmit={handleSave}>
                <label className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => update("enabled", event.target.checked)}
                  />
                  <span className="form-check-label">{t("enabled")}</span>
                </label>
                {settings.email_available && (
                  <label className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={form.email}
                      onChange={(event) => update("email", event.target.checked)}
                    />
                    <span className="form-check-label">{t("email")}</span>
                  </label>
                )}
                {settings.push_available && (
                  <label className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={form.push}
                      onChange={(event) => update("push", event.target.checked)}
                    />
                    <span className="form-check-label">
                      {t("push")}
                      <span className="form-check-description">
                        {settings.push_devices === 0
                          ? t("pushNone")
                          : t("pushOn", { n: settings.push_devices })}
                      </span>
                    </span>
                  </label>
                )}
                <FormLabel htmlFor="reminder-urls">{settings.email_available ? t("alsoSendTo") : t("sendTo")}</FormLabel>
                <textarea
                  id="reminder-urls"
                  className="form-control font-monospace"
                  rows={4}
                  placeholder={"ntfys://ntfy.sh/my-goalnexa-topic\nmailtos://user:app-password@gmail.com"}
                  value={form.urls}
                  onChange={(event) => update("urls", event.target.value)}
                />
                <small className="form-hint">
                  {t.rich("urlsHint", {
                    link: (text: string) => (
                      <a href="https://github.com/caronc/apprise/wiki" target="_blank" rel="noreferrer">
                        {text}
                      </a>
                    ),
                  })}
                  {settings.allowed_schemes && <> {t("accepts", { schemes: settings.allowed_schemes.join(", ") })}</>}
                </small>
                <FormLabel className="mt-3" htmlFor="reminder-digest">
                  {t("digest")}
                </FormLabel>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <select
                    id="reminder-digest"
                    className="form-select w-auto"
                    value={form.digest}
                    onChange={(event) => update("digest", event.target.value as DigestFrequency)}
                  >
                    <option value="weekly">{t("weekly")}</option>
                    <option value="daily">{t("daily")}</option>
                    <option value="off">{t("off")}</option>
                  </select>
                  {form.digest === "weekly" && (
                    <select
                      className="form-select w-auto"
                      aria-label={t("digestDay")}
                      value={form.digest_weekday}
                      onChange={(event) => update("digest_weekday", Number(event.target.value))}
                    >
                      {WEEKDAYS.map((day, i) => (
                        <option key={day} value={i}>
                          {t(day)}
                        </option>
                      ))}
                    </select>
                  )}
                  {form.digest !== "off" && (
                    <select
                      className="form-select w-auto"
                      aria-label={t("digestHour")}
                      value={form.digest_hour}
                      onChange={(event) => update("digest_hour", Number(event.target.value))}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <option key={hour} value={hour}>
                          {t("atHour", { time: `${String(hour).padStart(2, "0")}:00` })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <small className="form-hint">
                  {t("digestHint", { zone: browserTimeZone() })}
                  {zoneChanged && t("zoneChanged", { zone: settings.timezone })}.
                </small>
              </form>
            )}
            {error && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {error}
              </div>
            )}
            {notice && !error && (
              <div className="alert alert-success mt-3 mb-0" role="status">
                {notice}
              </div>
            )}
          </CardBody>
          {settings !== null && (
            <CardBody className="border-top d-flex gap-2">
              <Button type="submit" form="reminder-settings-form" variant="primary" disabled={busy || !(dirty || zoneChanged)}>
                {t("save")}
              </Button>
              <Button
                variant="secondary"
                outline
                disabled={busy || dirty || (!settings.urls.trim() && !settings.email && !(settings.push && settings.push_devices > 0))}
                title={dirty ? t("saveFirst") : undefined}
                onClick={() => void act(() => sendTestReminder(accessToken), t("testSent"))}
              >
                {t("sendTest")}
              </Button>
            </CardBody>
          )}
        </Card>
      </div>
      <div className="col-12 col-lg-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("dueNow")}</CardTitle>
          </CardHeader>
          {due === null ? (
            <CardBody>{!error && <div className="text-secondary">{t("loading")}</div>}</CardBody>
          ) : due.items.length === 0 ? (
            <CardBody>
              <div className="text-secondary">{t("nothingDue")}</div>
            </CardBody>
          ) : (
            <div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead>
                  <tr>
                    <th>{t("metric")}</th>
                    <th>{t("dueSince")}</th>
                  </tr>
                </thead>
                <tbody>
                  {due.items.map((metric) => (
                    <tr key={metric.id}>
                      <td>
                        <div className="text-secondary small">{metric.goal.title}</div>
                        {metric.name}
                      </td>
                      <td className="text-nowrap">{formatDateTime(metric.check_in_due_at as string, DUE, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {due.total > due.items.length && (
                <div className="card-footer text-secondary small">{t("more", { n: due.total - due.items.length })}</div>
              )}
            </div>
          )}
        </Card>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>{t("examples")}</CardTitle>
          </CardHeader>
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <tbody>
                {EXAMPLES.map(([service, example]) => (
                  <tr key={service}>
                    <td className="text-nowrap">{service === "webhook" ? t("webhook") : service}</td>
                    <td>
                      <code className="text-break">{example}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default RemindersScreen;
