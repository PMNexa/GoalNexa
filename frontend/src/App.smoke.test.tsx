import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "../../apps/platform-core/frontend/src/App";

/**
 * The critical regression this guards against isn't "does the route render
 * the right page" (platform-core's own test suite already covers that) —
 * it's "does rendering platform-core's component tree from INSIDE this
 * project even work at all," given this project imports that tree's source
 * files directly from the git submodule rather than a copy (see
 * README.md's "consume in place" section).
 *
 * If `scripts/link-platform-core-node-modules.mjs`'s symlink (or the
 * `resolve.dedupe` belt-and-suspenders in vite.config.ts) were ever broken
 * — e.g. two separate copies of `react` resolved for GoalNexa's own code
 * vs. platform-core's imported source — this test would fail with React's
 * own "Invalid hook call" error the moment `App` (which uses hooks
 * extensively: `useState`, `useContext`, `useQuery`, ...) tries to render,
 * not with some GoalNexa-specific symptom. A passing render here is the
 * actual proof the two "sides" share one React instance; a passing
 * `npm run build` alone is not (bundlers happily bundle two copies of a
 * package without erroring — only a real render exercises React's
 * hook-dispatcher singleton check).
 */
describe("consuming platform-core's App in place", () => {
  it("renders without throwing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // The public /login route should render without ever needing a backend
    // (no boot-time refresh dependency for an unauthenticated route to show
    // its form) - a non-empty render is enough to prove the component tree
    // mounted successfully across the submodule boundary.
    await waitFor(() => expect(container.textContent).not.toBe(""));
  });
});
