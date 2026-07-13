# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Local development, e.g. `docker-compose.dev.yml`. No `COPY . .` — the compose
# file bind-mounts the repo over /app so edits hot-reload without a rebuild;
# this stage only needs to exist to have node_modules installed.
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# One-shot Phase 14 maintenance image. The synchronizer uses only Node 24's
# built-in APIs/type stripping, so this stage deliberately avoids the full app
# dependency graph. `docker compose --profile maintenance run --rm --build
# model-sync` writes only public, pinned assets to the host mount.
FROM base AS model-sync
COPY package.json models.manifest.json ./
COPY scripts/sync-model-assets.ts ./scripts/sync-model-assets.ts
ENTRYPOINT ["node", "scripts/sync-model-assets.ts"]
CMD ["--output=/model-assets"]

FROM deps AS build
ARG VITE_MODEL_CDN_BASE_URL
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_CF_BEACON_TOKEN
ENV VITE_MODEL_CDN_BASE_URL=$VITE_MODEL_CDN_BASE_URL
ENV VITE_UMAMI_SCRIPT_URL=$VITE_UMAMI_SCRIPT_URL
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID
ENV VITE_CF_BEACON_TOKEN=$VITE_CF_BEACON_TOKEN
COPY . .
RUN pnpm build

# Nitro's node-server output is fully self-contained (dependencies are
# bundled into .output/server) — the runtime stage needs neither
# node_modules nor the pnpm toolchain, just Node and the build output.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
