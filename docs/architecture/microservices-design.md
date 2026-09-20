# GoalNexa microservice system design

Status: proposed, not yet implemented. Today's actual architecture is a step toward this already: GoalNexa's root holds no backend/frontend of its own, only an `apps/` folder of independent git submodules (`platform-core`, `platform-auth`, ...), each with its own repo/backend/frontend, listed in root `modules.yaml` (see root `README.md`/`AGENTS.md`). What's still missing versus this document's target: a real gateway/registry process, dynamic module registration, an event bus, and per-module MCP servers — this document defines that target and a phased path to it.

## Why now, not hypothetically

`docs/product-discovery/06-pressure-test.md` leaves two different product wedges unresolved: team-OKR tracking (B2B, unvalidated) and individual habit tracking (real but thin signal). A modular architecture isn't speculative infrastructure here — it's the direct answer to that strategic uncertainty: ship `core + goals` to one segment, `core + habits` to another, `core + goals + habits + team-okr + notifications` to a third, from the same codebase, without every deployment carrying code for a market it isn't serving.

## Goals

- Each module lives in its own git repo (own frontend, backend, optionally an MCP server), independently versioned and deployed.
- A module can be enabled or disabled **per deployment**, at runtime, without rebuilding anything else.
- Modules interact with each other without source-level coupling (no shared code, no git submodules between modules).
- A disabled or crashed module never takes down `core` or an unrelated module.
- Self-hosting stays realistic: one `docker compose up` for a small deployment, not a Kubernetes requirement.

## Non-goals (for now)

- Multi-region / horizontal auto-scaling per module — out of scope until a real deployment needs it.
- Hot-swapping a module's code without a restart — "enable/disable" means "running or not," not live code reload.
- Supporting third-party (non-PMNexa) modules — the contract below is designed so that's possible later, but it isn't a v1 requirement.

## Module boundaries

| Module | Owns | Depends on |
|---|---|---|
| `core` | Identity, `Organization`/`OrgMembership`/`Invite`, RBAC (`Permission`/`Role`/`RoleAssignment`), the module registry, the API gateway, the frontend shell | nothing |
| `goals` | The `Goal` entity (today's `goalnexa_ext`) | `core` (auth, org scoping) |
| `habits` | Habit definitions, check-ins, streaks | `core` |
| `team-okr` | Cascading objectives, review cycles, alignment views | `core`, reads `goals` via its API/events |
| `notifications` | Reminders, digests, delivery channels (email/push/webhook) | `core`; reacts to events from `goals`/`habits`/`team-okr` |
| `analytics` | Cross-module progress dashboards/reports | `core`; reads via each module's read API or a materialized event log |

`core` is the only module every deployment must run. Everything else is optional per the goal above.

## Topology

```
                        ┌─────────────────────┐
   browser  ───────────▶│   nginx (edge TLS)   │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │                               │
             ┌──────▼───────┐              ┌────────▼────────┐
             │ frontend shell│              │   API gateway    │
             │   (core)      │              │    (core)        │
             └──────┬────────┘              └────────┬─────────┘
                     │ loads enabled remotes           │ routes /api/<module>/*
       ┌─────────────┼──────────────┐        ┌─────────┼──────────┬─────────────┐
       ▼             ▼              ▼        ▼         ▼          ▼             ▼
  goals-frontend habits-frontend  ...    goals-api  habits-api  team-okr-api  notifications-api
       │             │                       │         │          │             │
       └─────────────┴───────────────────────┴─────────┴──────────┴─────────────┘
                                   │
                          event bus (Redis Streams)
                                   │
                     each module publishes/subscribes to
                        domain events it cares about

  Postgres: one instance, one schema per module (goals.*, habits.*, core.*, ...)
  MCP: one MCP server per module, each a thin wrapper over that module's own API
```

## The module contract

Every module repo ships a `module.json` at its root. This is the entire interface `core` needs to install, route to, and gate a module — nothing else is coupled.

```json
{
  "name": "habits",
  "version": "1.3.0",
  "apiPrefix": "/api/habits",
  "frontendRemote": "https://cdn.goalnexa.internal/habits/remoteEntry.js",
  "mcpUrl": "https://habits.goalnexa.internal/mcp",
  "permissions": [
    { "resource": "habit", "actions": ["create", "read", "update", "delete"] },
    { "resource": "habit_checkin", "actions": ["create", "read"] }
  ],
  "publishesEvents": ["habit.created", "habit.checked_in", "habit.streak_broken"],
  "subscribesToEvents": ["org.member_removed"],
  "navContribution": { "label": "Habits", "icon": "fa-solid fa-repeat", "scope": "org" },
  "healthCheckUrl": "/health",
  "requiresCoreVersion": ">=2.0.0"
}
```

A module registers itself by calling `POST /internal/modules/register` on `core` (with a shared internal secret, or mTLS) on startup — the runtime analog of today's `register_entity_config()` compile-time call. `core` stores the manifest, seeds the declared permissions into the RBAC catalog (idempotently, same existence-check-then-insert pattern already used for `goal.*`), and marks the module `discovered`. A separate `enabled` boolean, set by an operator, controls whether the gateway/frontend actually route to it — registration and enablement are different states on purpose, so a module can be installed and configured before going live.

## Data ownership

**One rule, no exceptions**: a module's database schema is only ever touched by that module's own migrations and queries. No cross-schema foreign keys. If `team-okr` needs to know a `Goal` exists, it stores the `goal_id` as an opaque UUID and either calls `goals`'s API to resolve it, or reads a denormalized projection built from `goal.*` events. This is what makes "disable `goals`, keep `team-okr` running" not a data-integrity landmine — `team-okr`'s own schema was never structurally dependent on `goals`'s tables existing.

Single Postgres instance, `CREATE SCHEMA <module_name>` per module, is the pragmatic default for a self-hosted product (one thing to back up, one connection string family). A module that outgrows this gets its own database later — the schema boundary is what makes that migration mechanical instead of a rewrite.

## Synchronous interaction

Module-to-module calls go through the gateway, never directly module-to-module (so the gateway remains the single place that knows the registry and can 404 a disabled module). Service-to-service auth: `core` runs a JWKS endpoint; the gateway forwards the caller's user-facing access token, and a calling module additionally presents a short-lived internal JWT (`iss: core-internal`, `aud: <target module>`) it fetched from `core` — the target module verifies both signatures against `core`'s published keys without needing its own login flow or shared secret per module pair.

## Asynchronous interaction (the primary integration mechanism)

Prefer events over direct calls whenever the caller doesn't need an immediate response — this is what actually gives you "modules interact without hard runtime dependencies." Recommend **Redis Streams**, not Kafka/RabbitMQ: self-hosted deployments already need Redis-or-nothing simplicity more than they need Kafka's throughput, and Postgres's own `LISTEN`/`NOTIFY` is a viable zero-new-infra fallback for a very small deployment if even Redis feels heavy.

Event envelope (versioned, so a subscriber written against `v1` doesn't break when the publisher adds a field):

```json
{
  "type": "goal.completed.v1",
  "orgId": "...",
  "occurredAt": "2026-09-21T00:00:00Z",
  "data": { "goalId": "...", "completedByActorId": "..." }
}
```

`notifications` subscribing to `goal.completed.v1` to send a congratulations email is the canonical example: `goals` never knows `notifications` exists, `notifications` works fine if `goals` is disabled (it just never receives that event), and disabling `notifications` doesn't touch `goals` at all.

## Frontend composition

Start simpler than full Module Federation: the shell (`core`'s frontend) fetches `GET /api/core/modules?enabled=true` at boot and, for each enabled module, adds a nav entry (from `navContribution`) and a route that lazy-loads that module's UI from its own deployed origin via a plain dynamic `import()` against its `frontendRemote` URL (Vite/Rollup support importing a remote ES module URL directly — no bundler-federation config needed for this). This gets you real runtime enable/disable with a fraction of Module Federation's setup cost. Upgrade to `@originjs/vite-plugin-federation` only when you actually need shared-dependency deduplication across module bundles (i.e., when bundle size/duplicate-React becomes a measured problem, not preemptively) — the "consume in place" symlink trick this repo already built for the `platform-core` submodule was solving exactly that problem for a build-time-coupled setup; Module Federation solves the same problem for a runtime-loaded one, and isn't needed until you're actually loading separately-built bundles into one page.

## MCP per module

Each module's MCP server is a thin wrapper exposing that module's own API as tools (e.g., `habits`'s MCP server exposes `log_checkin`, `list_habits`). No central MCP aggregator needed for v1 — an AI agent's own config simply lists one MCP endpoint per enabled module, sourced from the same module registry (`mcpUrl` field). Disabling a module removes its entry from that list the same way it removes the frontend remote and the gateway route.

## Enable/disable, end to end

1. Operator flips `enabled` on a module row in `core`'s registry (an admin UI action, or a config file for a fully self-hosted single-operator deployment).
2. Gateway's route table (cached, invalidated on registry change) stops proxying `/api/<module>/*` — a disabled module returns a clean `404 module_disabled`, not a timeout.
3. Frontend shell's next `/api/core/modules` fetch drops it from nav and stops importing its remote.
4. Deployment orchestration (docker-compose `--profile`, or a Helm values flag) stops running that module's containers entirely — the registry flag and the actual running state are two separate concerns that should usually move together, but treating them as separate is what lets an operator "soft-disable" a module (stop routing to it) before actually tearing down its infrastructure.

## Deployment model

No git submodules between modules — that was the right call for a single-deploy monolith consuming a shared platform (today's `platform-core` relationship, which stays as-is: `core` still consumes `platform-core` in place, since `core` and `platform-core` are genuinely one deployable). Between *modules*, the coupling is purely: a published container image + the `module.json` contract + the event schema.

Each module repo's own CI builds and publishes `ghcr.io/pmnexa/goalnexa-<module>:<version>` on tag. A separate, thin **ops repo** (not any module's repo) holds the `docker-compose.yml` / Helm chart that pins which image version of each module a given deployment runs — this is the file an operator edits to add, remove, upgrade, or disable a module, and it is the only place that "knows" all modules exist at once.

## RBAC across modules

`core` remains the single source of truth for `Permission`/`Role`/`RoleAssignment` — modules never maintain their own auth. A module contributes to the catalog only by declaring `permissions` in its manifest at registration time; `core` grants them to system roles via the same idempotent seed-migration pattern already established for `goal.*` (see `backend/alembic/versions/0002_seed_goal_permissions.py`), except triggered by the registration API call instead of a compile-time migration, since there's no shared process to run a migration against another module's absence.

## Migration path from today's architecture

Do not rewrite everything at once. Suggested phases:

1. **Extract the gateway and registry into `core` first**, with `goalnexa_ext`'s `Goal` routes still living in the same process as `core` (today's actual deployable) but reached *through* the gateway rather than mounted directly on `core`'s own FastAPI app. This proves the routing/registry contract without yet paying for a second deployable.
2. **Move `goals` into its own repo and container**, still calling `core`'s JWKS for auth, still same Postgres instance (new `goals` schema). This is the first real module boundary and validates the whole pattern end to end with the entity you already have.
3. **Add the event bus** once there's a second module (e.g. `notifications`) that actually needs to react to something `goals` does — building it before there's a real consumer is wasted ceremony.
4. **Only then** build `habits` or `team-okr` as new modules from day one in the target shape, informed by whichever wedge the product-discovery work actually validates.

## Open decisions (need your input before implementing)

- Redis Streams vs. Postgres `LISTEN`/`NOTIFY` for the event bus — the latter needs zero new infrastructure but doesn't survive a consumer being offline when the event fires (no durable queue); Streams does, at the cost of one more service to run.
- Whether `analytics` reads via each module's API (simpler, but N+1-ish and couples analytics' uptime to every module being up) or builds its own read-model from the event log (more resilient, more infrastructure).
- How aggressively to version `module.json`/event schemas — semver-strict from day one, or informally until a second team actually needs the discipline.
