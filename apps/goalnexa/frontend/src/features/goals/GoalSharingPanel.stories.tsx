import type { Meta, StoryObj } from "@storybook/react-vite";
import { delay, http, HttpResponse } from "msw";
import { fn } from "storybook/test";
import type { GoalMember } from "../../api/goalMembers";
import type { Goal } from "../../api/goals";
import { ACCESS_TOKEN, daysAgo, goals, ME, people, teams } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import GoalSharingPanel from "./GoalSharingPanel";

const GOAL_ID = goals[1].id;
const [, bao, chi] = people;

/** The goal the panel loads, and its members - every other endpoint is the default fake API. */
function sharing(goal: Partial<Goal>, members: GoalMember[] = []) {
  return {
    msw: {
      handlers: [
        http.get(`*/api/v1/goals/${GOAL_ID}`, () => HttpResponse.json({ ...goals[1], ...goal })),
        http.get("*/api/v1/goal-members", () =>
          HttpResponse.json({ items: members, total: members.length, page: 1, page_size: 100 }),
        ),
        ...handlers,
      ],
    },
  };
}

function member(userId: string, n: number): GoalMember {
  return { id: `08000000-0000-7000-8000-00000000010${n}`, goal: GOAL_ID, user_id: userId, created_at: daysAgo(10 + n) };
}

const meta = {
  title: "Goals/GoalSharingPanel",
  component: GoalSharingPanel,
  args: { accessToken: ACCESS_TOKEN, goalId: GOAL_ID, onChanged: fn(), onLeft: fn() },
} satisfies Meta<typeof GoalSharingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A personal goal: nothing to share, just a note. */
export const Personal: Story = { parameters: sharing({ org_id: null }) };

/** The owner's org goal, public: the whole org sees it; the owner can add members. */
export const OrgPublic: Story = { parameters: sharing({ visibility: "public" }) };

/** Private, with a member: only they and the owner see it; the owner removes or adds members. */
export const PrivateWithMembers: Story = { parameters: sharing({ visibility: "private" }, [member(bao.user_id, 1)]) };

/** Everyone in the org is already on the goal: no one left to add. */
export const EveryoneAdded: Story = {
  parameters: sharing({ visibility: "private" }, [member(bao.user_id, 1), member(chi.user_id, 2)]),
};

/** A team's goal, "Team only": the select offers that option too. */
export const TeamOnly: Story = { parameters: sharing({ visibility: "team", team_id: teams[1].id }) };

/** Someone else's private goal I'm a member of: visibility read-only, only "Leave" on my row. */
export const AsMember: Story = {
  parameters: sharing({ visibility: "private", owner_id: bao.user_id }, [member(ME, 1), member(chi.user_id, 2)]),
};

/** Someone else's public goal: read-only, nothing to do. */
export const AsNonOwner: Story = { parameters: sharing({ visibility: "public", owner_id: bao.user_id }) };

/** Still loading. */
export const Loading: Story = {
  parameters: { msw: { handlers: [http.get(`*/api/v1/goals/${GOAL_ID}`, () => delay("infinite")), ...handlers] } },
};

/** The goal couldn't be loaded. */
export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`*/api/v1/goals/${GOAL_ID}`, () =>
          HttpResponse.json({ code: "not_found", message: "Goal not found." }, { status: 404 }),
        ),
        ...handlers,
      ],
    },
  },
};
