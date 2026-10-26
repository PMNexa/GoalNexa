import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { expect, fn, userEvent, within } from "storybook/test";
import { FormSelect } from "platform-core";
import { ACCESS_TOKEN, orgs } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { onboardingHandlers } from "./onboarding.mocks";
import OnboardingWizard from "./OnboardingWizard";

const meta = {
  title: "Onboarding/OnboardingWizard",
  component: OnboardingWizard,
  args: { accessToken: ACCESS_TOKEN, onComplete: fn(), onSkip: fn() },
  parameters: { msw: { handlers: [...onboardingHandlers, ...handlers] } },
} satisfies Meta<typeof OnboardingWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First run: how will you use GoalNexa - an AI agent (recommended) or the website. */
export const ChooseMode: Story = {};

/** The website path's first step: name the organization. */
export const WebsiteFirstStep: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use the website/ }));
    await expect(await canvas.findByLabelText(/Organization name/)).toBeInTheDocument();
  },
};

/** The AI-agent path's first step: platform-mcp's connect guide (pick a client). */
export const AgentFirstStep: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use an AI agent/ }));
    await expect(await canvas.findByText("Connect your AI assistant")).toBeInTheDocument();
  },
};

/** The agent path's last step: starter prompts to copy. */
export const AgentStarterPrompts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use an AI agent/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await expect(await canvas.findByText("Tell it what you're working toward")).toBeInTheDocument();
  },
};

/** "Next" with no name: the step's problem is shown and the wizard stays put. */
export const WebsiteMissingName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use the website/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Give your organization a name.");
  },
};

/** The whole website path filled in, ending on the review step. */
export const WebsiteReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use the website/ }));
    await userEvent.type(await canvas.findByLabelText(/Organization name/), "Acme Inc.");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.type(await canvas.findByPlaceholderText("e.g. Grow monthly revenue"), "Grow monthly revenue");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.type(await canvas.findByLabelText("Metric name"), "MRR");
    await userEvent.type(canvas.getByLabelText("Unit"), "$");
    await userEvent.clear(canvas.getByLabelText("Start value"));
    await userEvent.type(canvas.getByLabelText("Start value"), "40000");
    await userEvent.type(canvas.getByLabelText("Target value"), "60000");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(await canvas.findByText("Ready to go")).toBeInTheDocument();
  },
};

/** An organization with no goals yet: no "Organization" step, and the heading's select switches org. */
export const ExistingOrg: Story = {
  args: {
    existingOrg: { id: orgs[0].id, name: orgs[0].name },
    orgPicker: (
      <FormSelect size="md" className="w-auto fw-semibold" aria-label="Organization" defaultValue={orgs[0].id}>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </FormSelect>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use the website/ }));
    await expect(await canvas.findByText("What are you aiming for?")).toBeInTheDocument();
  },
};

/** The create failed part-way: the error, and what went through is kept (locked) for the retry. */
export const CreateFailed: Story = {
  args: { existingOrg: { id: orgs[0].id, name: orgs[0].name } },
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/v1/metrics", () =>
          HttpResponse.json({ code: "limit_reached", message: "This organization has reached its metric limit." }, { status: 403 }),
        ),
        ...onboardingHandlers,
        ...handlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Use the website/ }));
    await userEvent.type(await canvas.findByPlaceholderText("e.g. Grow monthly revenue"), "Grow monthly revenue");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.type(await canvas.findByLabelText("Metric name"), "MRR");
    await userEvent.type(canvas.getByLabelText("Target value"), "60000");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Create and open dashboard" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("metric limit");
  },
};
