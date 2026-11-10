# Build context is the REPO ROOT, not apps/api: the install needs the lockfile, the workspace file and
# packages/shared. Build with:  docker build -f apps/api/Dockerfile -t balitrade-api .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# corepack picks the pnpm version from the root package.json ("packageManager"), so it matches local builds.
RUN corepack enable
WORKDIR /app

# --- dependencies -------------------------------------------------------------------------------
# Only the manifests, so this layer is reused as long as no dependency changed. `--ignore-scripts` is
# required: apps/api has a `postinstall` that runs `prisma generate`, and the schema is not copied yet.
FROM base AS deps
# Every workspace manifest is needed for pnpm to validate the lockfile; the --filter below then installs
# only this app and the workspace packages it depends on, so the other app's dependencies stay out.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@balitrade/api..."

# --- build --------------------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# prisma.config.ts resolves DATABASE_URL when it loads, even for `generate`, which never connects to a
# database. This placeholder exists only to satisfy that check; the real URL comes from the environment at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

# shared first: the API imports its compiled output. Then the Prisma client (generated, never committed),
# then Nest, which compiles src/ — including src/generated — into dist/.
RUN pnpm --filter @balitrade/shared build \
 && pnpm --filter @balitrade/api exec prisma generate \
 && pnpm --filter @balitrade/api exec nest build

# --- production dependencies --------------------------------------------------------------------
# A second, clean install without devDependencies. Cheaper and more predictable than pruning the tree above.
FROM base AS prod-deps
# Every workspace manifest is needed for pnpm to validate the lockfile; the --filter below then installs
# only this app and the workspace packages it depends on, so the other app's dependencies stay out.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@balitrade/api..."

# --- runtime ------------------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# pnpm links workspace packages with relative symlinks, so the paths below must match the build stages.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
# packages/shared has no runtime dependencies of its own, so a --prod install creates no node_modules for
# it and there is nothing to copy. Add that line here if it ever gains one.
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Never run as root. The node image already ships an unprivileged `node` user.
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main"]
