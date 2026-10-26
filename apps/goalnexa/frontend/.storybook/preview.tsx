import type { Preview } from "@storybook/react-vite";
import { setupWorker } from "msw/browser";
import { mswLoader } from "msw-storybook-addon/csf3";
import { handlers } from "../src/storybook/handlers";

const preview: Preview = {
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker();
      // An /api/ request no handler answers is a missing mock - say so in the console.
      await worker.start({
        quiet: true,
        onUnhandledRequest: (request, print) => {
          if (new URL(request.url).pathname.startsWith("/api/")) print.warning();
        },
      });
      return worker;
    }),
  ],
  parameters: {
    layout: "padded",
    msw: { handlers },
    controls: { matchers: { date: /(At|_at|Date|_date)$/ } },
  },
  decorators: [
    (Story) => (
      <div className="page-body" style={{ background: "var(--tblr-body-bg, #f6f8fb)", padding: "1rem", minHeight: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
