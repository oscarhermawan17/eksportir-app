# BaliTrade

B2B export marketplace: products from Bali sellers → buyers in Russia & CIS, with BaliTrade handling QC, payment holding and air cargo.

Project docs: `BRAINSTORMING.md` (business) · `ARCHITECTURE.md` (technical) · `TASKS.md` (work plan) · `UI_PROMPT.md` + `design-ui/` (design) · `docs/DECISIONS.md` (decision log) · `docs/CONVENTIONS.md` (coding guides).

## Working with an AI assistant

Start every session by telling the assistant to read **`AGENTS.md`** (project context, rules, gotchas, current status), then `TASKS.md`.
Claude Code reads `CLAUDE.md` automatically (it imports `AGENTS.md`); Codex/ChatGPT CLI, Cursor and most other tools read `AGENTS.md`;
Kiro uses `.kiro/steering` + `.kiro/skills`. All of them point to the same files, so nothing needs to be repeated. Suggested first message:

> Read AGENTS.md and TASKS.md, then continue with the next unticked task (follow .kiro/skills/next-task/SKILL.md).

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
├── docs/                       # DECISIONS.md, CONVENTIONS.md
├── AGENTS.md  CLAUDE.md        # AI assistant context (tool-agnostic)
├── .kiro/                      # Kiro steering + skills (skills are shared with other tools)
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
