# BaliTrade

B2B export marketplace: products from Bali sellers → buyers in Russia & CIS, with BaliTrade handling QC, payment holding and air cargo.

Project docs: `docs/BRAINSTORMING.md` (business) · `docs/ARCHITECTURE.md` (technical) · `TASKS.md` (work plan) · `docs/DESIGN.md` + `design-ui/` (design) · `docs/DECISIONS.md` (decision log) · `docs/CONVENTIONS.md` (coding guides) · `docs/API.md` (routes) · `docs/SECURITY.md` (security).

## Working with an AI assistant

Start every session by telling the assistant to read **`AGENTS.md`** (project context, rules, gotchas, current status), then `TASKS.md`.
Claude Code reads `CLAUDE.md` automatically (it imports `AGENTS.md`) and loads the skills in `.claude/skills/`; Codex/ChatGPT CLI, Cursor
and most other tools read `AGENTS.md`. Suggested first message:

> Read AGENTS.md and TASKS.md, then continue with the next unticked task (follow .claude/skills/next-task/SKILL.md).

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
│   │   ├── messages/           # UI texts per language: en.json, id.json, ru.json
│   │   └── src/app/[locale]/   # routes (App Router, /en /id /ru); globals.css = design tokens
│   └── api/                    # NestJS — http://localhost:4000/api
│       ├── prisma/             # schema.prisma, migrations/, seed.ts
│       ├── prisma.config.ts    # Prisma CLI config (DB url, seed command)
│       ├── src/
│       │   ├── main.ts         # bootstrap: /api prefix, CORS, port
│       │   ├── app.module.ts   # root module
│       │   ├── config/         # env validation
│       │   ├── prisma/         # PrismaService (global)
│       │   ├── auth/           # register, login, logout, me (JWT cookie), RBAC guards
│       │   ├── admin/          # admin-only endpoints (sellers, product review)
│       │   ├── sellers/        # seller onboarding, QC zones, ApprovedSellerGuard
│       │   ├── products/       # seller product CRUD, admin review, public catalog
│       │   ├── media/          # presigned upload/download URLs (Cloudflare R2)
│       │   ├── health/         # GET /api/health
│       │   ├── common/         # shared helpers (password hashing)
│       │   └── generated/      # Prisma client (generated, not committed)
│       └── test/               # e2e tests
├── packages/
│   └── shared/                 # enums, types, constants used by web and api
├── docs/                       # ARCHITECTURE, BRAINSTORMING, DESIGN, DECISIONS, CONVENTIONS, API, SECURITY
├── AGENTS.md  CLAUDE.md        # AI assistant context (tool-agnostic)
├── .claude/skills/             # convention guides + the next-task workflow (SKILL.md files)
├── docker-compose.yml          # local PostgreSQL
└── TASKS.md                    # what to build next
```

## Getting started

```bash
nvm use                       # Node 22
pnpm install                  # also generates the Prisma client
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Then pick a database. **Default: the VPS testing database over SSH**, so a fresh clone has real data with
nothing to seed (fill in `DATABASE_URL` as `apps/api/.env.example` describes):

```bash
pnpm db:tunnel                # leave running: localhost:5433 → VPS PostgreSQL
pnpm setup                    # Prisma client + shared package, then checks both database URLs
pnpm dev                      # web :3000 + api :4000 (+ shared in watch mode)
```

Or fully offline, against Docker — also what you need before changing `schema.prisma`:

```bash
pnpm db:up                    # start PostgreSQL in Docker
pnpm db:migrate               # apply migrations
pnpm db:seed                  # create the first admin (ADMIN_* in apps/api/.env)
pnpm dev
```

Check: open http://localhost:3000 and http://localhost:4000/api/health (`"database":"up"`).
`pnpm db:check` says which database each URL points at when that fails.

> `pnpm db:migrate`, `pnpm db:seed` and the e2e suite always run against `LOCAL_DATABASE_URL` (Docker) and
> refuse to touch the VPS — they can reset or delete data, and the VPS holds the only copy of the testing
> orders. Apply a committed migration to the VPS with `pnpm db:deploy` through the tunnel. Details in
> [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Scripts (root)

| Command | What it does |
|---|---|
| `pnpm dev` | Run shared (watch), api and web together |
| `pnpm build` | Build shared → api → web |
| `pnpm lint` / `pnpm typecheck` | Lint / type-check all packages |
| `pnpm test` | Unit tests · `pnpm --filter @balitrade/api test:e2e` for API e2e (needs DB) |
| `pnpm format` | Prettier |
| `pnpm setup` | Generate the Prisma client + shared package, then report both database URLs |
| `pnpm db:tunnel` | Open the SSH tunnel to the VPS database on `localhost:5433` (keep it running) |
| `pnpm db:check` | Which database each URL points at, and whether it answers (no passwords) |
| `pnpm db:up` / `db:down` | Start / stop the local Docker PostgreSQL |
| `pnpm db:migrate` | Create & apply a migration after editing `schema.prisma` (local Docker only) |
| `pnpm db:deploy` | Apply committed migrations to the database `DATABASE_URL` points at |
| `pnpm db:seed` / `db:studio` | Seed data (local Docker only) / open Prisma Studio |
