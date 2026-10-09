/**
 * Small per-browser UI state (localStorage; a storage failure just means
 * it isn't remembered), shared by the dashboard's tree: which goals are
 * shown, which metrics are hidden, which nodes are collapsed.
 */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered.
  }
}
