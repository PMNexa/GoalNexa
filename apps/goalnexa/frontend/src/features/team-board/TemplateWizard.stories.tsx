import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { ACCESS_TOKEN, cycles, orgs } from "../../storybook/fixtures";
import { emptyTemplate, orgTeams } from "./TeamBoardScreen.mocks";
import TemplateWizard from "./TemplateWizard";

const meta = {
  title: "Team board/TemplateWizard",
  component: TemplateWizard,
  args: {
    accessToken: ACCESS_TOKEN,
    orgId: orgs[0].id,
    existing: null,
    teams: orgTeams,
    cycles,
    cycleId: cycles[0].id,
    onDone: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof TemplateWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new template: its first step asks for the name. */
export const NewTemplate: Story = {};

/** Setting up an existing empty template: no name step, it opens on Goals. */
export const SetUpExisting: Story = { args: { existing: emptyTemplate } };

/** The Metrics step, after naming the template and its goal: one metric row to fill in. */
export const MetricsStep: Story = {
  args: { existing: emptyTemplate },
  play: async ({ canvasElement }) => {
    const modal = within(canvasElement.ownerDocument.body);
    await userEvent.type(await modal.findByLabelText(/Main goal/), "Grow revenue");
    await userEvent.click(modal.getByRole("button", { name: "Next" }));
  },
};

/** Next without a name: the step says what's missing. */
export const MissingName: Story = {
  play: async ({ canvasElement }) => {
    const modal = within(canvasElement.ownerDocument.body);
    await userEvent.click(await modal.findByRole("button", { name: "Next" }));
  },
};

/** An organization with no teams: the Teams step says to create them first. */
export const NoTeams: Story = {
  args: { existing: emptyTemplate, teams: [] },
};
