import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Metric } from "../../api/metrics";
import { ACCESS_TOKEN, metrics } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import MetricIngestPanel from "./MetricIngestPanel";

const METRIC = metrics[0];
const TOKEN = "gnm_Zq4cW1yHk2NfT8sLmP0aRbVx7Qa";

/**
 * The metric (starting with `hint` as its token's end) and its token
 * endpoints: creating sets a new token, revoking clears it - kept until
 * the story reloads.
 */
function ingest(metric: Metric, hint = "") {
  let current = hint;
  return {
    msw: {
      handlers: [
        http.get(`*/api/v1/metrics/${metric.id}`, () => HttpResponse.json({ ...metric, ingest_token_hint: current })),
        http.post(`*/api/v1/metrics/${metric.id}/ingest-token`, async ({ request }) => {
          await delay(300);
          current = TOKEN.slice(-4);
          return HttpResponse.json({ token: TOKEN, hint: current, url: `${new URL(request.url).origin}/api/v1/metrics/${metric.id}/ingest` });
        }),
        http.delete(`*/api/v1/metrics/${metric.id}/ingest-token`, async () => {
          await delay(300);
          current = "";
          return new HttpResponse(null, { status: 204 });
        }),
        ...handlers,
      ],
    },
  };
}

const meta = {
  title: "Metrics/MetricIngestPanel",
  component: MetricIngestPanel,
  args: { accessToken: ACCESS_TOKEN, metricId: METRIC.id, onChanged: fn() },
} satisfies Meta<typeof MetricIngestPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No token yet: just "Create token". */
export const NoToken: Story = { parameters: ingest(METRIC) };

/** An active token: only its last characters and the URL; rotate or revoke. */
export const ActiveToken: Story = { parameters: ingest(METRIC, "x7Qa") };

/** Right after "Create token": the token, shown once, in a ready-to-run curl (a reading - sends the current value). */
export const TokenIssued: Story = {
  parameters: ingest(METRIC),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Create token" }));
    await expect(await canvas.findByText("Copy the token now - it won't be shown again.")).toBeInTheDocument();
  },
};

/** A token issued for a `sum` metric: "amounts to add", and the curl sends 1. */
export const TokenIssuedSum: Story = {
  args: { metricId: metrics[2].id },
  parameters: ingest(metrics[2]),
  play: TokenIssued.play,
};

/** Revoking the active token: back to "No token yet." */
export const Revoked: Story = {
  parameters: ingest(METRIC, "x7Qa"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Revoke" }));
    await expect(await canvas.findByText("No token yet.")).toBeInTheDocument();
  },
};

/** Creating the token was refused (e.g. no permission on this metric). */
export const CreateRefused: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(`*/api/v1/metrics/${METRIC.id}/ingest-token`, () =>
          HttpResponse.json({ code: "permission_denied", message: "You can't change this metric." }, { status: 403 }),
        ),
        ...ingest(METRIC).msw.handlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Create token" }));
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};

/** Still loading. */
export const Loading: Story = {
  parameters: { msw: { handlers: [http.get(`*/api/v1/metrics/${METRIC.id}`, () => delay("infinite")), ...handlers] } },
};

/** The metric couldn't be loaded: no buttons. */
export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`*/api/v1/metrics/${METRIC.id}`, () => HttpResponse.json({ code: "not_found", message: "Metric not found." }, { status: 404 })),
        ...handlers,
      ],
    },
  },
};
