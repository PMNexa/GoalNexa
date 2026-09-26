/**
 * The organization the user is working in - the dashboard's org filter,
 * also switched from the host's header menu. An org id, or
 * `PERSONAL_ORG` for goals outside any org. Remembered per browser
 * (localStorage; a storage failure just means it isn't) and broadcast to
 * subscribers, so a switch from the header updates an open dashboard.
 * Other tabs follow through the `storage` event.
 */
export const PERSONAL_ORG = "__personal__";

const STORAGE_KEY = "goalnexa:dashboard-org";
const listeners = new Set<() => void>();

export function getCurrentOrg(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentOrg(key: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Not remembered - subscribers in this page still hear about it.
  }
  listeners.forEach((listener) => listener());
}

/** Calls `listener` after every switch; returns the unsubscribe. */
export function subscribeCurrentOrg(listener: () => void): () => void {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) listener();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
