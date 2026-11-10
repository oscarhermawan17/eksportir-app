# Build context is the REPO ROOT, not apps/web. Build with:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api -t balitrade-web .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- dependencies -------------------------------------------------------------------------------
FROM base AS deps
# Every workspace manifest is needed for pnpm to validate the lockfile; the --filter below then installs
# only this app and the workspace packages it depends on, so the other app's dependencies stay out.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@balitrade/web..."

# --- build --------------------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# The API address is compiled into the client bundle, so it is a build argument, not a runtime variable.
# This is why a web image built for one environment cannot be reused in another.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @balitrade/shared build \
 && pnpm --filter @balitrade/web exec next build

# --- runtime ------------------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# `output: standalone` traced exactly the files the server needs, with the monorepo layout preserved
# (outputFileTracingRoot in next.config.ts). Static assets and public/ are not traced and come separately.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
