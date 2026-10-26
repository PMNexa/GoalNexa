/**
 * The endpoints the onboarding wizard reaches beyond the default fake API:
 * the first answer (`onboarding-choice`), and what platform-mcp-frontend's
 * `McpConnectGuide` asks the MCP server (`initialize` + `tools/list` over
 * JSON-RPC) and its token/grant lists (polled to show "Connected").
 */
import { http, HttpResponse, type HttpHandler } from "msw";
import { daysAgo } from "../../storybook/fixtures";
import type { GoalDraft } from "./onboardingDrafts";

const TOOLS = ["goals_list", "goals_create", "metrics_list", "metrics_create", "check_ins_create", "goals_chart"].map((name) => ({ name }));

export const onboardingHandlers: HttpHandler[] = [
  http.post("*/api/v1/onboarding-choice", async ({ request }) => HttpResponse.json(await request.json())),
  http.post("*/api/v1/mcp", async ({ request }) => {
    const body = (await request.json()) as { id: number; method: string };
    const result = body.method === "initialize" ? { serverInfo: { name: "GoalNexa" } } : { tools: TOOLS };
    return HttpResponse.json({ jsonrpc: "2.0", id: body.id, result });
  }),
  http.get("*/api/v1/mcp/tokens", () => HttpResponse.json({ items: [] })),
  http.post("*/api/v1/mcp/tokens", async ({ request }) => {
    const { name } = (await request.json()) as { name: string };
    return HttpResponse.json(
      { id: crypto.randomUUID(), name, prefix: "gnx_demo", token: "gnx_demo_0123456789abcdef", created_at: daysAgo(0), last_used_at: null, expires_at: null },
      { status: 201 },
    );
  }),
  http.get("*/api/v1/mcp/oauth/grants", () => HttpResponse.json({ items: [] })),
];


/** Two filled-in goal drafts, as the website path's steps hold them. */
export const draftGoals: GoalDraft[] = [
  {
    key: 101,
    title: "Grow monthly revenue",
    description: "Pay for two more hires",
    targetDate: "2026-12-31",
    metrics: [
      { key: 201, name: "MRR", description: "From the billing dashboard", unit: "$", base: "40000", target: "60000" },
      { key: 202, name: "Churn rate", description: "", unit: "%", base: "8", target: "3" },
    ],
  },
  {
    key: 102,
    title: "Launch the beta",
    description: "",
    targetDate: "",
    metrics: [{ key: 203, name: "Beta testers", description: "", unit: "", base: "0", target: "50" }],
  },
];
