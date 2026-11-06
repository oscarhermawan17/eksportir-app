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
- Record new decisions: business → `docs/BRAINSTORMING.md`, technical → `docs/ARCHITECTURE.md`, and add a line to `docs/DECISIONS.md`. When you add or change an API route, run `pnpm docs:api` to update `docs/API.md`.
- **Git — one commit per finished task (standing instruction from the owner, 2026-11-02):** as soon as a task meets its DoD and
  lint/typecheck/tests pass, tick it in `TASKS.md` and **commit it before starting the next task**, without waiting to be asked.
  Usually two commits: the code (`feat:` / `fix:`), then the docs (`docs:`). Never carry one task's uncommitted work into the next;
  if a task is only partly done, commit nothing that does not build and say what is open. For anything else (a half-done task, a
  push, a branch) ask first. Author is the user only — **no `Co-authored-by` trailer**. Never commit `.env` files or secrets
  (`.env.example` placeholders are fine). Stage files explicitly; no `git add .`. No force-push / hard reset without asking.
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
  Each spec file cleans its own users by a unique email prefix (`auth-e2e-`, `e2e-rbac-`, `sellers-e2e-`, `media-e2e-`, `products-e2e-`,
  `adminprod-e2e-`, `fx-e2e-`, `catalog-e2e-`, `chat-e2e-`, `chatrt-e2e-`, `notif-e2e-`, `orders-e2e-`, `orderact-e2e-`); never share a prefix between files (they run in parallel). Presigned R2 URLs are computed offline, so tests use fake R2 env.
- Browser checks: headless Chrome via `puppeteer-core` works well (`/Applications/Google Chrome.app`). Delete test accounts afterwards.
- `pnpm add` of very recent packages may add them to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (already done for the AWS SDK).
- Seed data: `pnpm db:seed` creates the admin from `ADMIN_*` env and the 9 Bali QC zones (fees are **placeholders**).

## Current status

Update this block at the end of every task (the `[x]` ticks in `TASKS.md` stay the source of truth). Last handoff: **2026-11-06**,
commit `20da0be`, working tree clean, 18 of 28 tasks done (T01–T16, T13b and T16b).

**Done**
- Foundation and accounts: T01 monorepo · T02 database · T03 auth · T04 RBAC · T05 layout · T06 i18n (en/id/ru) · T07 seller onboarding.
- Products: T08 R2 upload · T09 seller CRUD · T10 admin review + manual translations · T11 manual USD/IDR rate (owner, `/admin/exchange-rate`) ·
  T12 public catalog (`/sellers/[id]`, search + filters; the catalog itself lives at `/` since T16b, detail at `/products/[id]`).
- Chat and notifications: T13 chat over Socket.IO (drawer on the product page, `/messages` inbox; text only, attachments moved to MVP 1.1) ·
  T13b admin-in-chat consent stored at sign-up · T14 in-app notifications (bell in the navbar, live).
- Orders: T15 request (dialog on the product page, `/orders` list and detail, order chat, seller notification) · T16 responses (seller accepts /
  declines / proposes a *lower* quantity; buyer accepts the change or cancels; each step = system message in the order chat + notification).
  All transitions live in `nextOrderStatus()` in `packages/shared/src/orders.ts`.
- UI: T16b simplified navbar (logo + search + language + bell + round avatar menu; no permanent text links, so it never wraps) ·
  `/` is the catalog (category chips, listing-type filter, thin trust band) · `/products` removed · new `/how-it-works` holds the six steps,
  trust cards, payment methods, shipping, FAQ and the seller invitation.
- Quality: lint and typecheck clean, 49 unit + 135 e2e tests green (e2e was repeated several times; run `pnpm --filter @balitrade/api test:e2e`).

**Next (in this order, unless the owner says otherwise)**
1. **T17 payment (3 methods).** Blocked on owner input, see "Waiting on the owner". Can start with placeholders in config if still missing.
2. **T17b** admin layout: dark-teal left sidebar **plus a plain top bar** (page title, language switcher, messages icon, avatar menu) — the owner
   confirmed both on 2026-11-06; spec in `docs/DESIGN.md`. The messages icon lives in the top bar only, not also in the sidebar. Add a simple
   Overview landing page (counts of pending sellers, listings and orders that need action). No buyer-management page: buyers are not moderated.
   The admin links now sitting in the storefront avatar menu move into the sidebar there.
3. Then T18 QC, T19 shipping + tracking, T20 completion + payout, T21 password reset, T22–T25 CI + deploy + backup + end-to-end test.

**Waiting on the owner**
- T17: USDT network and the Binance wallet address, BCA account details, the partner exchange and the instructions buyers must read, and
  whether exchange buyers need an amount in rubles. These belong in `.env`/config, never in code or chat.
- A real exchange rate. A dev value of **Rp 18,100 / USD** was entered on 2026-11-06 so the catalog could be judged; replace it with the real one.
- Decide later: seller response deadline and stock reservation for waiting orders (T16 has neither), QC tariff per zone (seed values are
  placeholders and show up on orders), forbidden-goods list, native-speaker review of the id/ru texts.

**Environment facts (dev)**
- Dev database has only 2 accounts: `admin@balitrade.local` (seed; password = `ADMIN_PASSWORD` in `apps/api/.env`, still the public placeholder) and
  `oscar.hermawan90@gmail.com` (SELLER, approved; no BUYER role, so it cannot order). There is no buyer account: register one at `/en/register`.
  The database may be reset freely at this stage.
- Sample data (2026-11-06, dev only): 12 approved products on the "Oscar Testing" seller across 7 categories, $2.49–$132.60, plus the Rp 18,100
  rate. Their photos are **generated placeholders** labelled "BaliTrade sample", not real product photos, and their id/ru texts are AI-written.
  The throwaway script is not in the repo; `pnpm db:seed` does not create them.
- R2: one bucket (`eksportir-testing`) serves as both public and private for now; split a private bucket before real payment proofs exist (T17+).
- Deploy plan: CI automatic on GitHub (T22), CD manual over SSH; **PostgreSQL is installed natively on the Ubuntu VPS, not in Docker**; only web
  and api run as containers (`docs/ARCHITECTURE.md` §8). `NEXT_PUBLIC_API_URL` is baked into the web image at build time.
- Footer still links to pages that do not exist (they show the 404 page): `/request`, `/faq`, `/contact`, `/terms`, `/privacy`, `/about`,
  `/seller-guidelines`. `/how-it-works` exists since T16b (with the `#payment` and `#shipping` anchors the footer uses). The navbar links to
  nothing that is missing: it has no text links at all.
- `pnpm docs:api` regenerates `docs/API.md` after route changes. Browser checks were ad-hoc headless-Chrome scripts in a temp folder and are not
  in the repo; recreate them with `puppeteer-core` when needed (login is limited to 5/min, so space out runs).

## Open questions (owner decisions still needed)

QC fee per zone (seed values are placeholders) · final product category list and forbidden-goods list · sourcing fee / deposit /
refund rules · payment details for T17 (see "Waiting on the owner") · seller response deadline and stock reservation ·
exchange-rate buffer. Full list: `docs/BRAINSTORMING.md` section 15 and `docs/DECISIONS.md`.
