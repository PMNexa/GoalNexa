# Production image of apps/main's frontend: `react-router build`, then
# `react-router-serve`. Build from the repo root, not this directory -
# main depends on every module's frontend as a `file:../../<module>`
# package, so the siblings have to sit at the same relative paths:
#   docker build -f apps/main/frontend/Dockerfile -t goalnexa-frontend .
FROM node:22-slim AS build
WORKDIR /apps
COPY apps/platform-core/frontend platform-core/frontend
COPY apps/platform-auth/frontend platform-auth/frontend
COPY apps/platform-org/frontend platform-org/frontend
COPY apps/platform-mcp/frontend platform-mcp/frontend
COPY apps/goalnexa/frontend goalnexa/frontend
# A module package's own imports resolve from its own node_modules.
RUN for module in platform-core platform-auth platform-org platform-mcp goalnexa; do \
      (cd "$module/frontend" && npm ci --no-audit --no-fund) || exit 1; \
    done
COPY apps/main/frontend main/frontend
WORKDIR /apps/main/frontend
# Fresh install, not `npm ci`: main's lockfile is made on macOS and lacks
# Linux's native rolldown binding (npm/cli#4828) - same as CI.
RUN rm -f package-lock.json && npm install --no-audit --no-fund \
    && npm run build \
    && npm prune --omit=dev

# The server bundle inlines every module package (vite.config.ts's
# ssr.noExternal), so runtime needs only main's own node_modules - the
# file: symlinks into the sibling modules are left dangling, unused.
FROM node:22-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /apps/main/frontend/package.json ./
COPY --from=build /apps/main/frontend/node_modules ./node_modules
COPY --from=build /apps/main/frontend/build ./build
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
