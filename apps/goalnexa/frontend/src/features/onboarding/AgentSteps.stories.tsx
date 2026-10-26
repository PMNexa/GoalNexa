import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ACCESS_TOKEN } from "../../storybook/fixtures";
import { handlers } from "../../storybook/handlers";
import { inCard } from "../../storybook/decorators";
import { onboardingHandlers } from "./onboarding.mocks";
import AgentSteps from "./AgentSteps";

const SKILLS_URL = "https://goal.example.com/api/v1/mcp/skills";

const meta = {
  title: "Onboarding/AgentSteps",
  component: AgentSteps,
  decorators: [inCard],
  args: {
    accessToken: ACCESS_TOKEN,
    step: 0,
    skillsUrl: SKILLS_URL,
    skillsPrompt: `Install the goalnexa skills from ${SKILLS_URL}`,
    onStep: fn(),
    onBack: fn(),
    onDone: fn(),
  },
  parameters: { msw: { handlers: [...onboardingHandlers, ...handlers] } },
} satisfies Meta<typeof AgentSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connect: platform-mcp's guide - pick the client, then its steps. */
export const Connect: Story = {};

/** Skills: the prompt that installs them, to copy. */
export const Skills: Story = { args: { step: 1 } };

/** Try it: starter prompts, and "Done - open dashboard". */
export const TryIt: Story = { args: { step: 2 } };
