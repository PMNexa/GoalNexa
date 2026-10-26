/**
 * The fake API every story gets (`.storybook/preview.tsx`): GoalNexa's
 * REST endpoints over the sample data in `fixtures.ts`, in memory. Lists
 * understand `filter{field}=` / `filter{field.in}=` / `filter{field.isnull}=`
 * and return the `{items, total, page, page_size}` envelope; writes echo
 * back. A story overrides one endpoint with `parameters.msw.handlers`
 * (`{ handlers: [http.get(...)] }` replaces them all - spread `handlers`
 * to keep the rest).
 */
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import * as data from "./fixtures";

type Row = Record<string, unknown>;

/** `metric.goal` on a check-in: follow the metric. */
function field(row: Row, path: string): unknown {
  if (path === "metric.goal") return data.metrics.find((m) => m.id === row.metric)?.goal;
  return row[path];
}

function filtered(rows: Row[], url: URL): Row[] {
  let out = rows;
  for (const [key, value] of url.searchParams) {
    const match = /^filter\{(.+?)(?:\.(in|isnull|lte|gte|lt|gt))?\}$/.exec(key);
    if (!match) continue;
    const [, path, op] = match;
    out = out.filter((row) => {
      const v = field(row, path);
      if (op === "in") return value.split(",").includes(String(v));
      if (op === "isnull") return (v === null || v === undefined) === (value === "true");
      if (op === "lte") return String(v ?? "") <= value && v !== null;
      if (op === "gte") return String(v ?? "") >= value && v !== null;
      if (op === "lt") return String(v ?? "") < value && v !== null;
      if (op === "gt") return String(v ?? "") > value && v !== null;
      return String(v) === value;
    });
  }
  return out;
}

/** `include[]=goal`: a metric's goal as the full row, like the API's sideloading. */
function included(row: Row, url: URL): Row {
  if (!url.searchParams.getAll("include[]").includes("goal") || typeof row.goal !== "string") return row;
  return { ...row, goal: data.goals.find((g) => g.id === row.goal) ?? row.goal };
}

function page(rows: Row[], url: URL) {
  const items = filtered(rows, url).map((row) => included(row, url));
  const pageSize = Number(url.searchParams.get("page_size") ?? 25);
  const pageNo = Number(url.searchParams.get("page") ?? 1);
  return { items: items.slice((pageNo - 1) * pageSize, pageNo * pageSize), total: items.length, page: pageNo, page_size: pageSize };
}

/** list / get / create / update / delete for one resource. */
export function collection(name: string, rows: Row[]): HttpHandler[] {
  const base = `*/api/v1/${name}`;
  return [
    http.get(base, ({ request }) => HttpResponse.json(page(rows, new URL(request.url)))),
    http.get(`${base}/:id`, ({ params }) => {
      // `<resource>/schema` isn't a row: a story rendering a platform-core form mocks it.
      if (params.id === "schema") return undefined;
      const row = rows.find((r) => r.id === params.id);
      return row ? HttpResponse.json(row) : HttpResponse.json({ code: "not_found", message: "Not found." }, { status: 404 });
    }),
    http.post(base, async ({ request }) => {
      await delay(200);
      const body = (await request.json()) as Row;
      return HttpResponse.json({ id: crypto.randomUUID(), ...body }, { status: 201 });
    }),
    http.patch(`${base}/:id`, async ({ params, request }) => {
      await delay(200);
      const row = rows.find((r) => r.id === params.id) ?? {};
      return HttpResponse.json({ ...row, ...((await request.json()) as Row) });
    }),
    http.put(`${base}/:id`, async ({ params, request }) => {
      await delay(200);
      return HttpResponse.json({ id: params.id, ...((await request.json()) as Row) });
    }),
    http.delete(`${base}/:id`, () => new HttpResponse(null, { status: 204 })),
  ];
}

const asRows = (rows: object[]) => rows as Row[];

export const handlers: HttpHandler[] = [
  http.get("*/api/v1/reminder-settings", () => HttpResponse.json(data.reminderSettings)),
  http.put("*/api/v1/reminder-settings", async ({ request }) =>
    HttpResponse.json({ ...data.reminderSettings, ...((await request.json()) as Row) }),
  ),
  http.post("*/api/v1/reminder-settings/test", () => new HttpResponse(null, { status: 204 })),
  http.post("*/api/v1/:kind/reorder", () => new HttpResponse(null, { status: 204 })),
  http.post("*/api/v1/check-ins/bulk", () => HttpResponse.json({ items: [] })),
  http.get("*/api/v1/org-members", () =>
    HttpResponse.json({ items: data.people, total: data.people.length, page: 1, page_size: 100 }),
  ),
  ...collection("orgs", asRows(data.orgs)),
  ...collection("teams", asRows(data.teams)),
  ...collection("cycles", asRows(data.cycles)),
  ...collection("goals", asRows(data.goals)),
  ...collection("metrics", asRows(data.metrics)),
  ...collection("check-ins", asRows(data.checkIns)),
  ...collection("goal-members", asRows(data.goalMembers)),
  ...collection("activities", asRows(data.activities)),
  ...collection("goal-comments", asRows(data.comments)),
  ...collection("goal-scores", []),
  ...collection("dashboard-shares", []),
  ...collection("goal-templates", []),
];
