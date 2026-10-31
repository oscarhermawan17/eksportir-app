# AGENTS.md — BaliTrade

Entry point for any AI coding assistant (Claude Code, Codex/ChatGPT, Cursor, Copilot, Gemini, ...).
Read this file first, then the documents listed under "Where to read more". Humans: see `README.md`.

## What this project is

BaliTrade is a B2B export marketplace: small Bali sellers list products, buyers in Russia & CIS order them,
and the BaliTrade team handles quality control (QC), payment holding and air cargo. Trust and transparency are the core value.
MVP 1.0 target date: 2026-10-31. The owner (Oscar) works mostly alone with AI assistants.

## Working agreement (important)

- **Talk to the user in Indonesian.** Code, comments, commit messages and default UI text are in English.
  UI is available in 3 languages (en default, id, ru); chat between users is English only.
- Do only the scope of the task. If something feels over-engineered, build the simplest clear version.
  If a task is too big, split it and ask.
- Work in **small steps** (a few files per step) and verify as you go; very long single responses have timed out before.
- A task is done only when its Definition of Done (DoD) in `TASKS.md` is met **and** `pnpm lint`, `pnpm typecheck`,
  `pnpm build` and the relevant tests pass. Do not tick a task whose DoD you could not verify (say what is blocked).
- Record new decisions: business → `docs/BRAINSTORMING.md`, technical → `docs/ARCHITECTURE.md`, and add a line to `docs/DECISIONS.md`. When you add or change an API route, update `docs/API.md`.
- **Git:** commit only when the user asks. Author is the user only — no `Co-authored-by` trailer. Never commit `.env` files
  or secrets (`.env.example` placeholders are fine). Stage files explicitly; no `git add .`. No force-push / hard reset without asking.
- Never print secret values (`.env`, API keys). Refer to them by variable name.
- Do not change the stack/framework without discussion.
- Visual source of truth for UI: `design-ui/google-stitch/01-v4.html` (tokens already in `apps/web/src/app/globals.css`).
  Other Stitch pages are only a reference for flows. Do not use the word "escrow" in UI (use "payment protection / payment held by BaliTrade").
  The `frontend-design` skill (`.claude/skills/frontend-design`) is advisory only: it never overrides these tokens (see `docs/CONVENTIONS.md`).

## Stack

pnpm monorepo, Node 22 (`.nvmrc`), TypeScript 6 strict everywhere.

| Part | Tech |
|---|---|
| `apps/web` | Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind 4, next-intl 4, lucide-react |
| `apps/api` | NestJS 12 (**ESM**), Prisma 7 + PostgreSQL 18 (Docker), Vitest, oxlint, class-validator |
| `packages/shared` | enums/types/constants shared by web and api (roles, locales, product, media, seller) |
| Storage | Cloudflare R2 (S3 API) via presigned URLs |

Commands (repo root): `pnpm dev` (web :3000 + api :4000), `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`,
`pnpm --filter @balitrade/api test:e2e` (needs `pnpm db:up` + `pnpm db:seed`), `pnpm db:migrate`, `pnpm db:seed`.
Setup steps are in `README.md`. Env files: `apps/api/.env`, root `.env` (from the `.env.example` files).

## Where to read more

| File | Content | Read when |
|---|---|---|
| `TASKS.md` | Ordered task list (T01–T25) with DoD and status ticks | Always, first |
| `docs/ARCHITECTURE.md` | Stack, roles/RBAC, data model, order status flow, MVP scope, decisions, R2 setup | Before backend/db work |
| `docs/BRAINSTORMING.md` | Business model, flows, open decisions (section 15) | Before product/flow decisions |
| `docs/DESIGN.md` | Design system, per-page screen specs and "Catatan implementasi" (what NOT to copy from the designs) | Before UI work |
| `design-ui/google-stitch/*.html` | Reference designs (visual truth: `01-v4.html`) | UI work |
| `docs/DECISIONS.md` | Chronological log of decisions + open questions | Before changing earlier choices |
| `docs/CONVENTIONS.md` | Index of the convention guides (`.claude/skills/*`) | Before writing code |
| `docs/API.md` | Every API route with its access rule | Before adding or calling an endpoint |
| `docs/SECURITY.md` | What is protected, open security items, checklist before deploy | Before auth, upload, money or deploy work |

## Conventions (summary — details in `.claude/skills/*/SKILL.md`, indexed in `docs/CONVENTIONS.md`)

- API (`apps/api`): one folder per feature module; thin controllers, logic in services; DB only via `PrismaService`;
  global `ValidationPipe` (whitelist + forbidNonWhitelisted); DTOs for all input; never trust client for price/status/role.
  Relative imports need the `.js` extension (ESM). Prisma client is imported from `src/generated/prisma/client.js`.
- Auth: JWT in httpOnly cookie `bt_session`; `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`; seller-only endpoints also
  use `ApprovedSellerGuard`. Status changes go through one function (`nextStatus()` in `products/product-status.ts`).
- Web (`apps/web`): routes under `src/app/[locale]/`; all UI text in `messages/{en,id,ru}.json` (same keys in all three);
  use `Link/useRouter/usePathname` from `@/i18n/navigation`; API calls via `@/lib/api` (`apiFetch`, `errorKey`);
  server components by default, `'use client'` only for interaction; labelled inputs, visible focus, contrast ≥ 4.5:1.
- Money: IDR as whole-number `Int`, USD as `Decimal(12,2)`, rates `Decimal(12,4)`; orders store price/rate snapshots.
- Dependencies: pin exact versions, mention new ones to the user.

## Gotchas learned (save yourself time)

- **Next.js 16 differs from older versions:** `proxy.ts` replaces `middleware.ts`; with `cacheComponents` a client component using
  `usePathname()/useSearchParams()` on a route with dynamic segments needs a `<Suspense>` boundary (Navbar/Footer are wrapped in
  `[locale]/layout.tsx`); dynamic route params are read inside `<Suspense>`. Docs are in `apps/web/node_modules/next/dist/docs/`.
- Unknown URLs: `[locale]/[...rest]/page.tsx` + `not-found.tsx` + `app/global-not-found.tsx` (experimental flag) avoid a reload loop.
- **`pnpm dev` API (nest --watch) can stay dead after `pnpm build`** (build wipes `dist`). Fix: make a trivial edit in any
  `apps/api/src` file and revert it. Also check nothing else holds port 4000 (`lsof -iTCP:4000 -sTCP:LISTEN`) before starting.
- **API e2e tests:** login is rate-limited (5/min per app instance) → log in once per user and reuse the supertest agent; a spec with more than 5 users mints session cookies with `JwtService` instead (see `test/chat.e2e-spec.ts`).
  Each spec file cleans its own users by a unique email prefix (`e2e-`, `sellers-e2e-`, `media-e2e-`, `products-e2e-`,
  `adminprod-e2e-`, `fx-e2e-`, `catalog-e2e-`, `chat-e2e-`); never share a prefix between files (they run in parallel). Presigned R2 URLs are computed offline, so tests use fake R2 env.
- Browser checks: headless Chrome via `puppeteer-core` works well (`/Applications/Google Chrome.app`). Delete test accounts afterwards.
- `pnpm add` of very recent packages may add them to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (already done for the AWS SDK).
- Seed data: `pnpm db:seed` creates the admin from `ADMIN_*` env and the 9 Bali QC zones (fees are **placeholders**).

## Current status

Update this block at the end of every task (the `[x]` ticks in `TASKS.md` stay the source of truth).

- Done: T01 monorepo · T02 database · T03 auth API · T04 RBAC · T05 web layout/login/register · T06 i18n (en/id/ru) ·
  T07 seller onboarding (admin approves sellers) · T08 media upload (verified against real R2 on 2026-10-27) ·
  T09 seller product CRUD · T10 admin listing review + manual translations (+ minimal public `GET /api/products`) ·
  T11 manual USD/IDR exchange rate (owner sets it at `/admin/exchange-rate`; catalog returns `priceUsd`, null until a rate exists —
  the owner still has to enter the first real rate) · T12 public catalog (`/products`, `/products/[id]`, `/sellers/[id]`,
  search + category/type filters; order/ask buttons go to login for guests and are disabled for logged-in users until T13/T15).
- Home page is built (hero, trust, steps, categories, latest products, FAQ). Navbar/footer still link to pages that do not exist yet (they show the 404 page): `/request`, `/how-it-works`, `/faq`, `/contact`, `/terms`, `/privacy`, `/about`, `/seller-guidelines`.
- R2 dev setup: one bucket (`eksportir-testing`) serves as both public and private for now. Split off a separate private
  bucket before real payment proofs / QC files exist (T17+).
- In progress: **T13 chat** — REST API and the web UI (drawer on the product page, `/messages` inbox, 4 s polling) are done and tested; still open: Socket.IO realtime, attachments, message rate limit (see `TASKS.md`). Then **T14** notifications, the order flow T15+, and **T17b** admin layout.
- Uncommitted work may exist — check `git status` before starting.

## Open questions (owner decisions still needed)

QC fee per zone (seed values are placeholders) · final product category list and forbidden-goods list · sourcing fee / deposit /
refund rules. Full list: `docs/BRAINSTORMING.md` section 15 and `docs/DECISIONS.md`.
