import { useEffect, useState } from "react";
import type { CrudFieldOption } from "platform-core";
import { apiFetch } from "./api/client";
import type { Goal } from "./api/goals";

/**
 * The user's own goals as `{value: id, label: title}` pairs - shared by
 * `metricsCrudConfig.ts`'s `goal` select field, `goalsCrudConfig.ts`'s own
 * `parent` select field, and both those configs' id -> title column
 * lookups, so a relation reads as a name everywhere instead of a bare
 * uuid. `null` while loading (distinct from `[]`, meaning "loaded,
 * genuinely no goals yet") - a caller building a create/edit form should
 * wait for it rather than rendering a `select` with zero options.
 *
 * `excludeId` drops one goal from the list - `GoalsEditScreen` passes the
 * goal being edited, so it can't be offered as its own `parent` (the
 * backend also rejects this - see `GoalViewSet._resolve_parent` - this
 * is just keeping it off the list in the first place).
 */
export function useGoalOptions(accessToken: string, excludeId?: string) {
  const [goalOptions, setGoalOptions] = useState<CrudFieldOption[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ items: Goal[] }>("/api/v1/goals?page_size=100", accessToken)
      .then((page) => {
        if (!cancelled) {
          setGoalOptions(
            page.items.filter((goal) => goal.id !== excludeId).map((goal) => ({ value: goal.id, label: goal.title })),
          );
        }
      })
      .catch((thrown: unknown) => {
        if (!cancelled) setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, excludeId]);

  return { goalOptions, error };
}
