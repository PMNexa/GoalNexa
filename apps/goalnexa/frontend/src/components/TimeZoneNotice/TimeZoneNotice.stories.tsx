import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { expect, fn, userEvent, within } from "storybook/test";
import { reminderSettings } from "../../storybook/fixtures";
import TimeZoneNotice from "./TimeZoneNotice";

/** Saved as `zone` - the notice shows when it isn't the browser's own. */
const saved = (zone: string) => ({
  msw: {
    handlers: [
      http.get("*/api/v1/reminder-settings", () => HttpResponse.json({ ...reminderSettings, timezone: zone })),
      http.patch("*/api/v1/reminder-settings", async ({ request }) =>
        HttpResponse.json({ ...reminderSettings, ...((await request.json()) as object) }),
      ),
    ],
  },
});

const meta = {
  title: "Components/TimeZoneNotice",
  component: TimeZoneNotice,
  args: { accessToken: "token", onChanged: fn() },
  beforeEach: () => {
    try {
      localStorage.removeItem("goalnexa:zone-kept");
    } catch {
      // No storage: nothing remembered anyway.
    }
  },
} satisfies Meta<typeof TimeZoneNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Saved as UTC (the default) on a device elsewhere: asks which to use. */
export const SavedAsUtc: Story = {
  parameters: saved("Pacific/Kiritimati"),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /^Use / }));
    await expect(args.onChanged).toHaveBeenCalled();
  },
};

/** "Keep" hides it, remembered for this pair of zones. */
export const Kept: Story = {
  parameters: saved("Pacific/Kiritimati"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /^Keep / }));
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};
