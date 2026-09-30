import { useEffect, useState, type SubmitEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, FormLabel } from "platform-core";
import { errorMessage } from "../lib/api/goalMembers";
import {
  fetchDueMetrics,
  fetchReminderSettings,
  saveReminderSettings,
  sendTestReminder,
  type DigestFrequency,
  type DueMetric,
  type ReminderSettings,
  type ReminderSettingsInput,
} from "../lib/api/reminders";

export interface RemindersScreenProps {
  accessToken: string;
}

const DUE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The browser's IANA time zone - digests go out at the chosen hour there. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formFrom(row: ReminderSettings): ReminderSettingsInput {
  const { allowed_schemes: _schemes, ...form } = row;
  return form;
}

const EXAMPLES = [
  ["Email", "mailtos://user:app-password@gmail.com"],
  ["ntfy", "ntfys://ntfy.sh/my-goalnexa-topic"],
  ["Telegram", "tgram://bot-token/chat-id"],
  ["Slack", "slack://TokenA/TokenB/TokenC/#channel"],
  ["Discord", "discord://webhook-id/webhook-token"],
  ["Webhook (JSON POST)", "json://example.com/hooks/goalnexa"],
];

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
    }, "Saved.");
  }

  function update<K extends keyof ReminderSettingsInput>(key: K, value: ReminderSettingsInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const dirty =
    settings !== null &&
    form !== null &&
    (Object.keys(form) as (keyof ReminderSettingsInput)[]).some((key) => key !== "timezone" && form[key] !== settings[key]);
  const zoneChanged = settings !== null && settings.urls !== "" && settings.timezone !== browserTimeZone();

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-7">
        <Card>
          <CardHeader>
            <CardTitle>Check-in reminders</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-secondary">
              Give a metric a schedule (its <strong>Check in every</strong> field) and, once a check-in is overdue, its
              goal's owner gets a reminder listing everything that's due - one message, once per due date.
            </p>
            {settings === null || form === null ? (
              !error && <div className="text-secondary">Loading…</div>
            ) : (
              <form id="reminder-settings-form" onSubmit={handleSave}>
                <label className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => update("enabled", event.target.checked)}
                  />
                  <span className="form-check-label">Send me reminders</span>
                </label>
                <FormLabel htmlFor="reminder-urls">Send to</FormLabel>
                <textarea
                  id="reminder-urls"
                  className="form-control font-monospace"
                  rows={4}
                  placeholder={"ntfys://ntfy.sh/my-goalnexa-topic\nmailtos://user:app-password@gmail.com"}
                  value={form.urls}
                  onChange={(event) => update("urls", event.target.value)}
                />
                <small className="form-hint">
                  One{" "}
                  <a href="https://github.com/caronc/apprise/wiki" target="_blank" rel="noreferrer">
                    Apprise URL
                  </a>{" "}
                  per line; lines starting with # are ignored.
                  {settings.allowed_schemes && <> This server accepts: {settings.allowed_schemes.join(", ")}.</>}
                </small>
                <FormLabel className="mt-3" htmlFor="reminder-digest">
                  Goals digest
                </FormLabel>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <select
                    id="reminder-digest"
                    className="form-select w-auto"
                    value={form.digest}
                    onChange={(event) => update("digest", event.target.value as DigestFrequency)}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="off">Off</option>
                  </select>
                  {form.digest === "weekly" && (
                    <select
                      className="form-select w-auto"
                      aria-label="Digest day"
                      value={form.digest_weekday}
                      onChange={(event) => update("digest_weekday", Number(event.target.value))}
                    >
                      {WEEKDAYS.map((day, i) => (
                        <option key={day} value={i}>
                          on {day}
                        </option>
                      ))}
                    </select>
                  )}
                  {form.digest !== "off" && (
                    <select
                      className="form-select w-auto"
                      aria-label="Digest hour"
                      value={form.digest_hour}
                      onChange={(event) => update("digest_hour", Number(event.target.value))}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <option key={hour} value={hour}>
                          at {String(hour).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <small className="form-hint">
                  What moved, what's at risk or off track, what's achieved and which check-ins are due - across your goals
                  and your organizations' shared ones. Your time zone: {browserTimeZone()}
                  {zoneChanged && <> (saved as {settings.timezone} - save to update)</>}.
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
                Save
              </Button>
              <Button
                variant="secondary"
                outline
                disabled={busy || dirty || !settings.urls.trim()}
                title={dirty ? "Save first" : undefined}
                onClick={() => void act(() => sendTestReminder(accessToken), "Test message sent.")}
              >
                Send a test
              </Button>
            </CardBody>
          )}
        </Card>
      </div>
      <div className="col-12 col-lg-5">
        <Card>
          <CardHeader>
            <CardTitle>Due now</CardTitle>
          </CardHeader>
          {due === null ? (
            <CardBody>{!error && <div className="text-secondary">Loading…</div>}</CardBody>
          ) : due.items.length === 0 ? (
            <CardBody>
              <div className="text-secondary">Nothing's due. Metrics without a schedule never are.</div>
            </CardBody>
          ) : (
            <div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Due since</th>
                  </tr>
                </thead>
                <tbody>
                  {due.items.map((metric) => (
                    <tr key={metric.id}>
                      <td>
                        <div className="text-secondary small">{metric.goal.title}</div>
                        {metric.name}
                      </td>
                      <td className="text-nowrap">{DUE.format(Date.parse(metric.check_in_due_at as string))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {due.total > due.items.length && (
                <div className="card-footer text-secondary small">And {due.total - due.items.length} more.</div>
              )}
            </div>
          )}
        </Card>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>URL examples</CardTitle>
          </CardHeader>
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <tbody>
                {EXAMPLES.map(([service, example]) => (
                  <tr key={service}>
                    <td className="text-nowrap">{service}</td>
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
