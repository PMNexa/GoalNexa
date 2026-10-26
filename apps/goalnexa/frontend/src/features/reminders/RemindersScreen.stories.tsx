import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import { expect, userEvent, within } from "storybook/test";
import type { DueMetric, ReminderSettings } from "../../api/reminders";
import { ACCESS_TOKEN, daysAgo, goals, metrics, reminderSettings } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import RemindersScreen from "./RemindersScreen";

/** A fixture metric as the due list gets it: its goal sideloaded (`include[]=goal`). */
function due(index: number, hoursOverdue: number): DueMetric {
  const metric = metrics[index];
  const goal = goals.find((g) => g.id === metric.goal) ?? goals[0];
  return { ...metric, goal: { id: goal.id, title: goal.title }, check_in_due_at: daysAgo(hoursOverdue / 24) };
}

const DUE: DueMetric[] = [due(2, 30), due(0, 8), due(3, 1)];

interface Setup {
  settings?: Partial<ReminderSettings>;
  dueItems?: DueMetric[];
  dueTotal?: number;
  extra?: HttpHandler[];
}

function setup({ settings = {}, dueItems = DUE, dueTotal = dueItems.length, extra = [] }: Setup = {}) {
  const row = { ...reminderSettings, ...settings };
  return {
    msw: {
      handlers: [
        ...extra,
        http.get("*/api/v1/reminder-settings", () => HttpResponse.json(row)),
        http.put("*/api/v1/reminder-settings", async ({ request }) => {
          await delay(300);
          return HttpResponse.json({ ...row, ...((await request.json()) as object) });
        }),
        http.post("*/api/v1/reminder-settings/test", async () => {
          await delay(300);
          return new HttpResponse(null, { status: 204 });
        }),
        http.get("*/api/v1/metrics", () => HttpResponse.json({ items: dueItems, total: dueTotal, page: 1, page_size: 50 })),
        ...handlers,
      ],
    },
  };
}

const NOTHING: Partial<ReminderSettings> = { enabled: false, urls: "", email: false, push: false, push_devices: 0, digest: "off" };

const meta = {
  title: "Reminders/RemindersScreen",
  component: RemindersScreen,
  args: { accessToken: ACCESS_TOKEN },
} satisfies Meta<typeof RemindersScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Set up: email, the phone app on one phone, a Telegram URL, a weekly digest; three metrics due. */
export const Configured: Story = { parameters: setup() };

/** Nothing set up yet and nothing due ("Send a test" has nowhere to go). */
export const NothingSetUp: Story = { parameters: setup({ settings: NOTHING, dueItems: [] }) };

/** This instance can't send email: no email box, the URLs are "Send to"; a hosted server lists the schemes it accepts. */
export const EmailUnavailable: Story = {
  parameters: setup({ settings: { email_available: false, email: false, allowed_schemes: ["ntfys", "tgram", "slack", "discord"] } }),
};

/** No push relay: no phone-app option. */
export const PushUnavailable: Story = { parameters: setup({ settings: { push_available: false, push: false, push_devices: 0 } }) };

/** Push on, but no phone signed in yet: how to get one. */
export const PushNoPhones: Story = { parameters: setup({ settings: { push_devices: 0 } }) };

/** A daily digest: no weekday to pick. */
export const DailyDigest: Story = { parameters: setup({ settings: { digest: "daily", digest_hour: 7 } }) };

/** More due than the first page: "And 47 more." */
export const ManyDue: Story = { parameters: setup({ dueTotal: DUE.length + 47 }) };

/** Saved in another time zone than this browser's: Save is offered to update it. */
export const OtherTimeZone: Story = { parameters: setup({ settings: { timezone: "Pacific/Kiritimati" } }) };

/** Saving a change: "Saved." */
export const Saved: Story = {
  parameters: setup(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(await canvas.findByLabelText("Goals digest"), "daily");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent("Saved.");
  },
};

/** Saving refused (an URL the server doesn't accept): its message, the form kept. */
export const SaveError: Story = {
  parameters: setup({
    extra: [
      http.put("*/api/v1/reminder-settings", () =>
        HttpResponse.json(
          { code: "validation_error", message: "Invalid input.", field_errors: { urls: ["Line 2: json:// isn't allowed on this server."] } },
          { status: 400 },
        ),
      ),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Also send to"), "\njson://example.com/hook");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};

/** "Send a test": sent. */
export const TestSent: Story = {
  parameters: setup(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Send a test" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent("Test message sent.");
  },
};

/** "Send a test" failed to deliver: the server's message. */
export const TestFailed: Story = {
  parameters: setup({
    extra: [
      http.post("*/api/v1/reminder-settings/test", () =>
        HttpResponse.json({ code: "delivery_failed", message: "Couldn't deliver to tgram://…: bot token rejected." }, { status: 502 }),
      ),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Send a test" }));
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};

/** Still loading. */
export const Loading: Story = {
  parameters: setup({ extra: [http.get("*/api/v1/reminder-settings", () => delay("infinite")), http.get("*/api/v1/metrics", () => delay("infinite"))] }),
};

/** The settings couldn't be loaded. */
export const LoadError: Story = {
  parameters: setup({
    extra: [http.get("*/api/v1/reminder-settings", () => HttpResponse.json({ code: "server_error", message: "Something went wrong." }, { status: 500 }))],
  }),
};
