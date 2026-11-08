import { useEffect, useState } from "react";
import { Button, useT } from "platform-core";
import { errorMessage } from "../../api/goalMembers";
import { fetchReminderSettings, patchReminderSettings } from "../../api/reminders";
import { browserTimeZone, zoneOffset } from "../../lib/timeZone";
import messages from "./TimeZoneNotice.messages";

export interface TimeZoneNoticeProps {
  accessToken: string;
  /** After the zone was changed - the goals' check-in times moved with it. */
  onChanged?: () => void;
  /** On the wrapper, e.g. a grid column - nothing is rendered when there's nothing to ask. */
  className?: string;
}

/** "Keep" is remembered per (saved, device) pair: a trip to another zone asks again. */
const KEPT_KEY = "goalnexa:zone-kept";

function kept(): string | null {
  try {
    return localStorage.getItem(KEPT_KEY);
  } catch {
    return null;
  }
}

function withOffset(zone: string): string {
  const offset = zoneOffset(zone);
  return offset ? `${zone} (${offset})` : zone;
}

/**
 * P-106: a goal's check-in times count in its owner's saved zone (UTC until
 * set), so someone whose saved zone isn't this device's is asked once which
 * to use - "Monday 00:00" in UTC was showing as 07:00 in Vietnam. Renders
 * nothing when they match or the browser can't tell its zone.
 */
function TimeZoneNotice({ accessToken, onChanged, className }: TimeZoneNoticeProps) {
  const t = useT(messages);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const device = browserTimeZone();

  useEffect(() => {
    let cancelled = false;
    fetchReminderSettings(accessToken)
      .then((row) => !cancelled && setSaved(row.timezone))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const pair = `${saved}|${device}`;
  if (hidden || saved === null || !device || saved === device || kept() === pair) return null;

  async function switchZone() {
    setBusy(true);
    setError(null);
    try {
      await patchReminderSettings(accessToken, { timezone: device });
      setHidden(true);
      onChanged?.();
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  function keep() {
    try {
      localStorage.setItem(KEPT_KEY, pair);
    } catch {
      // Not remembered: asked again next visit.
    }
    setHidden(true);
  }

  return (
    <div className={className}>
      <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 mb-0" role="status">
        <span className="me-auto">{t("text", { saved: withOffset(saved), device: withOffset(device) })}</span>
        <Button variant="primary" disabled={busy} onClick={() => void switchZone()}>
          {busy ? t("using") : t("use", { zone: device })}
        </Button>
        <Button variant="light" disabled={busy} onClick={keep}>
          {t("keep", { zone: saved })}
        </Button>
        {error && <div className="w-100 text-danger small">{error}</div>}
      </div>
    </div>
  );
}

export default TimeZoneNotice;
