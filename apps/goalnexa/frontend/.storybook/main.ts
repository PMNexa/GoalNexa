import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook for goalnexa-frontend: one story file next to each component
 * (`Component.stories.tsx`). API calls are answered by MSW handlers
 * (`src/storybook/handlers.ts`), so stories need no backend.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  addons: ["msw-storybook-addon"],
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // platform-core / platform-mcp-frontend are file: packages with their
    // own node_modules - one React (and react-router) for the whole graph.
    config.resolve = { ...config.resolve, dedupe: ["react", "react-dom", "react-router"] };
    return config;
  },
};

export default config;
