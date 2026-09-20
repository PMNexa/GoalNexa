# Build context is the REPO ROOT (see docker-compose.yml's `context: .`,
# `dockerfile: frontend/Dockerfile`), not this directory — this image needs
# both `frontend/` and the `platform-core/` git submodule, which sits at the
# repo root as a sibling of `frontend/`, not inside it (see README.md's
# "consume in place" note).

# Build stage
FROM node:20 AS build
WORKDIR /app
COPY platform-core/frontend ./platform-core/frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
COPY frontend/scripts ./frontend/scripts
WORKDIR /app/frontend
# rm the copied lockfile before install: a documented npm bug (npm/cli#4828)
# leaves a lockfile generated on one platform (this repo's committed one was
# generated on macOS/arm64) missing the correct platform-specific optional
# dependency entry (@rollup/rollup-*, esbuild's native binary) when `npm
# install` runs against it on a different platform/libc - reproduced for
# real building this image (both linux-arm64-musl and linux-arm64-gnu
# variants missing, confirming it's the lockfile's own content at fault,
# not the base image). npm's own error message recommends exactly this: drop
# the lockfile and let a fresh `npm install` regenerate one.
RUN rm -f package-lock.json && npm install
WORKDIR /app
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build

# Serve stage
FROM nginx:alpine AS serve
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
