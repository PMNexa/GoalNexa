import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import { expect, userEvent, within } from "storybook/test";
import type { Activity, GoalComment } from "../../api/feed";
import { ACCESS_TOKEN, goals, ME } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { feedActivities, feedComments } from "./GoalActivityPanel.mocks";
import GoalActivityPanel from "./GoalActivityPanel";

const GOAL_ID = goals[0].id;

const list = <T,>(items: T[]) => HttpResponse.json({ items, total: items.length, page: 1, page_size: 100 });

/** The feed and the comments the panel loads; a posted comment is added to them (until the story reloads). */
function feed(activities: Activity[], comments: GoalComment[], extra: HttpHandler[] = []) {
  const posted: GoalComment[] = [];
  return {
    msw: {
      handlers: [
        ...extra,
        http.get("*/api/v1/activities", () => list(activities)),
        http.get("*/api/v1/goal-comments", () => list([...comments, ...posted])),
        http.post("*/api/v1/goal-comments", async ({ request }) => {
          await delay(300);
          const body = (await request.json()) as { goal: string; body: string };
          const row: GoalComment = { id: crypto.randomUUID(), author_id: ME, check_in: null, created_at: new Date().toISOString(), ...body };
          posted.push(row);
          return HttpResponse.json(row, { status: 201 });
        }),
        ...handlers,
      ],
    },
  };
}

const meta = {
  title: "Goals/GoalActivityPanel",
  component: GoalActivityPanel,
  args: { accessToken: ACCESS_TOKEN, goalId: GOAL_ID },
} satisfies Meta<typeof GoalActivityPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every kind of entry, newest first: check-ins (web, AI agent, ingest URL, phone, replacing / replaced), edits, health, metric and goal changes, a cycle score, roll-over, and comments (mine can be deleted). */
export const Feed: Story = { parameters: feed(feedActivities, feedComments) };

/** A new goal: nothing yet. */
export const Empty: Story = { parameters: feed([], []) };

/** A personal goal: no org members to name, so everything is "You". */
export const Personal: Story = {
  parameters: feed(feedActivities.slice(0, 5), [], [
    http.get(`*/api/v1/goals/${GOAL_ID}`, () => HttpResponse.json({ ...goals[0], org_id: null })),
  ]),
};

/** Writing and posting a comment: it shows at the top of the feed once saved. */
export const PostingAComment: Story = {
  parameters: feed(feedActivities.slice(0, 3), []),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Comment"), "Pricing test starts Monday.");
    await userEvent.click(canvas.getByRole("button", { name: "Comment" }));
    await expect(await canvas.findByText("Pricing test starts Monday.")).toBeInTheDocument();
  },
};

/** A comment the server refused: its message, and the draft is kept. */
export const CommentRefused: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/v1/goal-comments", () =>
          HttpResponse.json(
            { code: "validation_error", message: "Invalid input.", field_errors: { body: ["Ensure this field has no more than 2000 characters."] } },
            { status: 400 },
          ),
        ),
        ...feed(feedActivities.slice(0, 3), []).msw.handlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Comment"), "A very long comment…");
    await userEvent.click(canvas.getByRole("button", { name: "Comment" }));
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};

/** Still loading. */
export const Loading: Story = {
  parameters: { msw: { handlers: [http.get("*/api/v1/activities", () => delay("infinite")), ...handlers] } },
};

/** The feed couldn't be loaded. */
export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/v1/activities", () => HttpResponse.json({ code: "server_error", message: "Something went wrong." }, { status: 500 })),
        ...handlers,
      ],
    },
  },
};
