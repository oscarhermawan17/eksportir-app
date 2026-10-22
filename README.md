# BaliTrade

B2B export marketplace: products from Bali sellers → buyers in Russia & CIS, with BaliTrade handling QC, payment holding and air cargo.

Project docs: `BRAINSTORMING.md` (business) · `ARCHITECTURE.md` (technical) · `TASKS.md` (work plan) · `UI_PROMPT.md` + `design-ui/` (design).

## Stack

| Part | Version |
|---|---|
| Node.js | 22 (see `.nvmrc`) · pnpm 12 |
| Web | Next.js 16.4 (App Router, Turbopack) · React 19.3 · Tailwind CSS 4.3 |
| API | NestJS 12.2 (ESM) · Vitest · oxlint |
| Database | PostgreSQL 18 (Docker) · Prisma 7.10 (`@prisma/adapter-pg`) |
| Language | TypeScript 6.0 (strict) |

## Structure

```
.
├── apps/
│   ├── web/                    # Next.js — http://localhost:3000
│   │   └── src/app/            # routes (App Router); globals.css = design tokens
│   └── api/                    # NestJS — http://localhost:4000/api
│       ├── prisma/             # schema.prisma, migrations/, seed.ts
│       ├── prisma.config.ts    # Prisma CLI config (DB url, seed command)
│       ├── src/
│       │   ├── main.ts         # bootstrap: /api prefix, CORS, port
│       │   ├── app.module.ts   # root module
│       │   ├── config/         # env validation
│       │   ├── prisma/         # PrismaService (global)
│       │   ├── health/         # GET /api/health
│       │   ├── common/         # shared helpers (password hashing)
│       │   └── generated/      # Prisma client (generated, not committed)
│       └── test/               # e2e tests
├── packages/
│   └── shared/                 # enums & types used by web and api (roles, locales)
├── docker-compose.yml          # local PostgreSQL
└── TASKS.md                    # what to build next
```

## Getting started

```bash
nvm use                       # Node 22
pnpm install                  # also generates the Prisma client
cp .env.example .env
cp apps/api/.env.example apps/api/.env

pnpm db:up                    # start PostgreSQL in Docker
pnpm db:migrate               # apply migrations
pnpm db:seed                  # create the first admin (ADMIN_* in apps/api/.env)

pnpm dev                      # web :3000 + api :4000 (+ shared in watch mode)
```

Check: open http://localhost:3000 and http://localhost:4000/api/health (`"database":"up"`).

## Scripts (root)

| Command | What it does |
|---|---|
| `pnpm dev` | Run shared (watch), api and web together |
| `pnpm build` | Build shared → api → web |
| `pnpm lint` / `pnpm typecheck` | Lint / type-check all packages |
| `pnpm test` | Unit tests · `pnpm --filter @balitrade/api test:e2e` for API e2e (needs DB) |
| `pnpm format` | Prettier |
| `pnpm db:up` / `db:down` | Start / stop PostgreSQL |
| `pnpm db:migrate` | Create & apply a migration after editing `schema.prisma` |
| `pnpm db:seed` / `db:studio` | Seed data / open Prisma Studio |
