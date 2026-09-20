import { describe, expect, it } from "vitest";

import {
  ADMIN_ENTITY_KEYS,
  entityLabelByKey,
  orgScopedEntities,
  registerOrgScopedEntity,
} from "../../apps/platform-core/frontend/src/pages/admin/registry";

/**
 * Confirms GoalNexa's own registration call (main.tsx) actually lands in
 * platform-core's registry — the mechanism `AppSidebar`/`AppBreadcrumb`/
 * `useEntitySchema` all read from. This is what makes the Goal entity show
 * up in nav/breadcrumbs/admin routing with zero platform-core edits.
 */
describe("registering GoalNexa's Goal entity into platform-core's admin registry", () => {
  it("adds the entry to orgScopedEntities, entityLabelByKey, and ADMIN_ENTITY_KEYS", () => {
    registerOrgScopedEntity({ key: "goal-test-only", label: "Goal (test)" });

    expect(orgScopedEntities.some((e) => e.key === "goal-test-only")).toBe(true);
    expect(entityLabelByKey["goal-test-only"]).toBe("Goal (test)");
    expect(ADMIN_ENTITY_KEYS.has("goal-test-only")).toBe(true);
  });

  it("is a no-op for a key that's already registered", () => {
    const before = orgScopedEntities.length;
    registerOrgScopedEntity({ key: "goal-test-only", label: "Goal (test), renamed" });

    expect(orgScopedEntities.length).toBe(before);
    // Original label wins - the first registration, not a silent overwrite.
    expect(entityLabelByKey["goal-test-only"]).toBe("Goal (test)");
  });
});
