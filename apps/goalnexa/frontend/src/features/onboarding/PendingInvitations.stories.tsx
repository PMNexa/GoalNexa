import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { fn } from "storybook/test";
import { ACCESS_TOKEN } from "../../storybook/fixtures";
import { inCard } from "../../storybook/decorators";
import { invitations } from "../dashboard/dashboard.mocks";
import PendingInvitations from "./PendingInvitations";

const meta = {
  title: "Onboarding/PendingInvitations",
  component: PendingInvitations,
  decorators: [inCard],
  args: { accessToken: ACCESS_TOKEN, invitations, onAccepted: fn(), onDeclined: fn() },
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/v1/org-invitations/token/:token/accept", () =>
          HttpResponse.json({ org: invitations[0].org, role: "member" }),
        ),
        http.post("*/api/v1/org-invitations/token/:token/decline", () => new HttpResponse(null, { status: 204 })),
      ],
    },
  },
} satisfies Meta<typeof PendingInvitations>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One open invitation: who sent it, the role, Join / Decline. */
export const One: Story = {};

/** Two invitations at once. */
export const Several: Story = {
  args: {
    invitations: [
      ...invitations,
      {
        ...invitations[0],
        id: "09000000-0000-7000-8000-000000000002",
        token: "inv-token-2",
        role: "admin",
        org: { id: "02000000-0000-7000-8000-000000000010", name: "Running club" },
        invited_by: { id: "x", name: null, email: "coach@example.com" },
      },
    ],
  },
};

/** Joining failed (e.g. the invitation expired meanwhile). */
export const AcceptFails: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/v1/org-invitations/token/:token/accept", () =>
          HttpResponse.json({ detail: "This invitation has expired." }, { status: 400 }),
        ),
      ],
    },
  },
};
