/**
 * Time zones (P-106). A goal's frequency, due times and quotas count in its
 * zone - the org's, else its owner's (`reminder-settings`), else UTC - so the
 * user picks theirs instead of it staying UTC.
 */

/** The browser's IANA time zone, or "" when it can't tell. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/** Every IANA zone the browser knows, with `extra` (a saved one it may not list) included. */
export function timeZones(...extra: string[]): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  const all = new Set(zones);
  for (const zone of ["UTC", ...extra]) if (zone) all.add(zone);
  return [...all].sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}

/** "GMT+07:00" for a zone right now, or "" if the browser can't tell. */
export function zoneOffset(zone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value === "GMT" ? "GMT+00:00" : (part?.value ?? "");
  } catch {
    return "";
  }
}
