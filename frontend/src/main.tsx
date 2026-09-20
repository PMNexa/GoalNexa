import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// GoalNexa's own design-system entry point (npm-installed, not the CDN link
// platform-core's own index.html uses — GoalNexa is self-hosted and its
// core UI shouldn't depend on jsdelivr being reachable at runtime; see
// README.md). platform-core's frontend source files (imported below) carry
// no CSS imports of their own — Tabler's classes are all they emit markup
// against, so loading it once here is enough for the whole app, including
// every platform-core component rendered through `App`.
import "@tabler/core/dist/css/tabler.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

// "Consume in place": these are platform-core's own source files, imported
// directly from the git submodule rather than copied into this project
// (see README.md). `App` already wraps its routes in `AuthProvider`
// internally, so nothing else needs to here.
import App from "../../apps/platform-core/frontend/src/App";
import { registerOrgScopedEntity } from "../../apps/platform-core/frontend/src/pages/admin/registry";

// Registers GoalNexa's own `Goal` entity into platform-core's generic admin
// CRUD surface — must run before the app's first render (see
// `registry.ts`'s own docstring on why: nothing here is React state, it's a
// plain module-level registration `AppSidebar`/`AppBreadcrumb`/
// `useEntitySchema` all read from directly). The matching backend half is
// `goalnexa_ext/routes/goals.py`'s `register_entity_config` call.
registerOrgScopedEntity({ key: "goal", label: "Goals" });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
