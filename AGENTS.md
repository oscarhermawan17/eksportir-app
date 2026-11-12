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
| `docs/DEPLOY.md` | The live testing environment: SSH, server layout, deploying, certificates, database, secrets, GitHub | **Before touching the VPS or CI** |

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
- **Never run `pnpm build` while `pnpm dev` is running.** `next dev` and `next build` share `apps/web/.next`, and the build overwrites
  manifests the dev server is holding open. The symptom is every page answering 500 with
  `SyntaxError: Unexpected non-whitespace character after JSON` from the dev log — the message files are fine, a `.next` manifest is not.
  The same applies to `pnpm typecheck` for the web app: it runs `next typegen`, which writes into `.next` too.
  **Stop `pnpm dev` before running either, then start it again.**
  Recovery without a restart: the broken file is usually `apps/web/.next/dev/prerender-manifest.json`
  (`find . -name '*.json' -not -path '*/node_modules/*' | xargs -n1 python3 -c "import json,sys; json.load(open(sys.argv[1]))"` finds it).
  Writing a minimal one — `{"version":4,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{…}}`, reusing the `preview` block from a
  real build — and touching a source file brings the dev server back. Otherwise `rm -rf apps/web/.next` and restart `pnpm dev`.
  Do not try `next start` on another port instead: the API's CORS only allows `WEB_ORIGIN` (`http://localhost:3000`), so logins fail.
  A `distDir` override was tried and reverted: `next typegen` then rewrites `tsconfig.json` on every run.
- **`pnpm dev` API (nest --watch) can stay dead after `pnpm build`** (build wipes `dist`). Fix: make a trivial edit in any
  `apps/api/src` file and revert it. Also check nothing else holds port 4000 (`lsof -iTCP:4000 -sTCP:LISTEN`) before starting.
- **API e2e tests:** login is rate-limited (5/min per app instance) → log in once per user and reuse the supertest agent; a spec with more than 5 users mints session cookies with `JwtService` instead (see `test/chat.e2e-spec.ts`).
  Each spec file cleans its own users by a unique email prefix (`auth-e2e-`, `e2e-rbac-`, `sellers-e2e-`, `media-e2e-`, `products-e2e-`,
  `adminprod-e2e-`, `fx-e2e-`, `catalog-e2e-`, `chat-e2e-`, `chatrt-e2e-`, `notif-e2e-`, `orders-e2e-`, `orderact-e2e-`); never share a prefix between files (they run in parallel). Presigned R2 URLs are computed offline, so tests use fake R2 env.
- Browser checks: headless Chrome via `puppeteer-core` works well (`/Applications/Google Chrome.app`). Delete test accounts afterwards.
- `pnpm add` of very recent packages may add them to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (already done for the AWS SDK).
- Seed data: `pnpm db:seed` creates the admin from `ADMIN_*` env and the 9 Bali QC zones (fees are **placeholders**).

## Current status

Update this block at the end of every task (the `[x]` ticks in `TASKS.md` stay the source of truth). Last handoff: **2026-11-12**,
working tree clean, 24 of 30 tasks done (T01–T17, T13b, T16b, T16c, T17b, T22, T23 and T26).

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
- T16c **home per role** (`homePathFor()` in `apps/web/src/lib/home-path.ts` decides where login lands and where the logo points):
  seller → `/seller` dashboard, admin → admin area, buyer → `/`. Sellers and admins get "View the shop" in the account menu.
  The seller account form moved to `/seller/account`. **Admin accounts are admin-only**: no "My orders" or "Sell on BaliTrade" in their
  menu (a person who also trades uses a second account); the order list sits in the Admin group instead.
- T17b **admin area has its own chrome**: route groups split it from the shop — `[locale]/layout.tsx` is document + translations + session only,
  `(shop)` holds the navbar and footer, `(admin)` holds a 240px dark-teal sidebar plus a plain top bar (page title, language, inbox icon,
  avatar) and no product search. URLs are unchanged. Menu by role in `navItemsFor()` (`src/components/admin/admin-nav.ts`); `/admin` is an
  Overview of work waiting; `/admin/orders` reuses the shop's order components through a `basePath` prop. Below `lg` the sidebar is a drawer.
- T17 **payments, three methods, checked by hand**: `Payment` rows are recorded **per attempt and never replaced**, so one order can have several
  (partial transfers are accepted on purpose) and a rejected attempt stays visible with its reason. Verifying one payment only records that the
  money arrived; the order moves to `PAYMENT_VERIFIED` when a FINANCE admin presses "payment is complete" (`POST /api/admin/orders/:id/confirm-paid`),
  because no sum can decide that when partial payments are allowed. Quality control is a separate OPS step (`/start-qc` → `IN_QC`), so the data never
  claims QC began before the goods are in hand. Buyer screen `/orders/[id]/pay`, admin screen `/admin/payments` (FINANCE + OWNER). Account details come
  from `PAY_*` in `.env`; a method whose fields are empty is not offered, and `PAY_MOCK=true` puts a warning on the payment page. Proof files go to the
  private bucket under `private/<uploaderId>/`, so only the buyer and admins can open them, and the API refuses a key that is not the buyer's own.
- T22 **CI** and T23 **deploy**: GitHub Actions runs lint, typecheck, 53 unit and 153 e2e tests on every push to
  `main`, then builds `balitrade-api` and `balitrade-web` and pushes them to GHCR; deploying stays manual.
  The testing environment runs at https://projectbali.my.id — see `docs/DEPLOY.md`.
  **Three CI failures taught the same lesson:** a clean checkout has no `packages/shared/dist`, no Prisma client
  and no `.next`, and `pnpm install` produces none of them. `pnpm codegen` now makes the first two, and `build`,
  `typecheck` and `test` all call it. Before pushing anything that touches the build, delete those artefacts and
  run the chain locally — otherwise a laptop full of months-old build output proves nothing about CI.
- T26 **product categories are data the owner manages**, not `PRODUCT_CATEGORIES` in `packages/shared`: table `ProductCategory`,
  OWNER-only page `/admin/categories` (create, edit the en/id/ru labels, reorder, tick `active`, archive). **No delete anywhere** — the owner
  dropped it on 2026-11-12 after seeing the screen: off and archived cover every real case and both are reversible, so the page has no
  irreversible button and there is no `DELETE` route.
  Unticking a category takes its listings out of the catalog, the filters and `/products/:id` (which answers "not available") **without
  touching their `ProductStatus`**, so ticking it back restores everything; the seller still sees them with a "category switched off" badge.
  One constant does that work — `visibleToBuyers` in `apps/api/src/products/catalog.service.ts`, shared by list, detail and seller page.
  `onDelete: Restrict` stays in the schema as a net, not a feature. A seller moving a listing to another category does restore it, but through
  review again: editing an `APPROVED` product sends it back to `PENDING_REVIEW` (the T09 rule, unchanged).
  The migration moved **no data** — the FK is on `slug` and the column kept the name `category`. An unknown slug in `?category=` answers
  200 + empty, not 400, so a bookmarked filter URL survives a category going away.
- Quality: lint and typecheck clean, `pnpm build` clean, 56 unit + 169 e2e tests green (run `pnpm --filter @balitrade/api test:e2e`).

**Next (in this order, unless the owner says otherwise)**
0. **T24 backup** is now the most valuable unfinished task, not the next one in number order: the database shares
   a box with the app, so `pg_dump` to R2 **with a restore actually tried once** is the only thing standing between
   a dead disk and losing every order record. It also owns the rest of `docs/DEPLOY.md`'s open checklist.
1. **T18 QC.** Starts from `IN_QC`, which T17 already reaches. ADMIN_OPS uploads the report (photos/video, checklist, comment) → `QC_READY`;
   the buyer approves or reports a problem. Its admin page is a new entry in `ADMIN_NAV` (`src/components/admin/admin-nav.ts`), roles OPS + OWNER,
   and QC files belong in the **private** bucket, like payment proofs.
2. Then T19 shipping + tracking (it reuses the payment screens through `PaymentPurpose.SHIPPING`, already in the schema), T20 completion + payout,
   T21 password reset (nothing resets a forgotten password today — the owner edits the database), T25 end-to-end test.
   Each adds its own `ADMIN_NAV` entry and, where it makes sense, a tile on the admin Overview.

**Small things left open (not blocking anything)**
- The admin top bar's ✉ icon opens `/messages`, which still renders in the shop chrome. Giving it `/admin/messages` needs the same treatment
  orders got (a second route plus a `basePath`-style prop); the inbox also carries its own `?c=` parameter.
- Separate ADMIN_OPS and ADMIN_FINANCE accounts **were** exercised on 2026-11-10 (throwaway fixtures, deleted afterwards): each sidebar showed only
  its own pages and the cross-role buttons are gone. Two bugs that only appear with a non-OWNER admin were found and fixed then — see `docs/DECISIONS.md`.
- ~~`/admin/orders` and `/orders` show the same heading twice~~ — fixed 2026-11-12: the admin top bar is the only page title.

**Waiting on the owner**
- **Look at `/admin/categories` once (T26, 2026-11-12).** The behaviour was verified end to end from the API and the public catalog, but
  the owner's own screen was never opened in a browser by the assistant — the admin password was deliberately not typed into a tool call.
- **Before any real money moves (T17 is otherwise finished):** the **USDT network** (still TBA — a wrong network loses the buyer's funds) and the real
  Binance wallet address, the real BCA account details, and the partner exchange's contact and instructions. Put them in `apps/api/.env` under the
  `PAY_*` names in `.env.example` and set `PAY_MOCK=false`; no code changes. Also **split off a private R2 bucket**: create one with public access off
  and point `R2_PRIVATE_BUCKET` at it (it currently holds the same name as the public bucket, so payment proofs land in a world-readable bucket).
- A real exchange rate. A dev value of **Rp 18,100 / USD** was entered on 2026-11-06 so the catalog could be judged; replace it with the real one.
- Decide later: seller response deadline and stock reservation for waiting orders (T16 has neither), QC tariff per zone (seed values are
  placeholders and show up on orders), forbidden-goods list, native-speaker review of the id/ru texts.

**Environment facts (dev)**
- Dev database has only 2 accounts: `admin@balitrade.local` (seed; password = `ADMIN_PASSWORD` in `apps/api/.env`, still the public placeholder) and
  `oscar.hermawan90@gmail.com` (SELLER, approved; no BUYER role, so it cannot order). There is no buyer account: register one at `/en/register`.
  The database may be reset freely at this stage.
- **The VPS database is almost empty by design** (2026-11-11): the admin plus the 9 QC zones that `pnpm db:seed`
  creates, and the rate the owner entered (Rp 18,150 / USD). The seller and sample products exist only in the
  local dev database — they came from a throwaway script that was deliberately never committed. The owner is
  filling the testing site by hand through the UI, which also exercises R2 uploads over real HTTPS, cookies on a
  real domain and the chat WebSocket through nginx — none of which localhost tests.
- The admin on the VPS is `admin@balitrade.local`; its password is in `/home/ubuntu/balitrade/.env`. It was the
  public `.env.example` placeholder until 2026-11-11 (the seed read the laptop's `.env`), which on a public repo
  meant anyone could sign in as admin. **Never seed a reachable environment with placeholder credentials.**
- Sample data (2026-11-06, dev only): 12 approved products on the "Oscar Testing" seller across 7 categories, $2.49–$132.60, plus the Rp 18,100
  rate. Their photos are **generated placeholders** labelled "BaliTrade sample", not real product photos, and their id/ru texts are AI-written.
  The throwaway script is not in the repo; `pnpm db:seed` does not create them.
- R2: one bucket (`eksportir-testing`) serves as both public and private for now. **Splitting off a private bucket is part of T17** (decided 2026-11-08): payment proofs show account numbers and full names, and the current bucket is public, so a URL is the only thing between a proof and anyone holding it. Presigned GET exists since T08, so the change is one bucket plus one env variable; QC files (T18) need it too.
- **The testing environment is live: https://projectbali.my.id (2026-11-11).** `docs/DEPLOY.md` is the operations
  manual — how to reach the server, what runs where, how to deploy, certificates, the database, secrets, GitHub.
  **Read it before touching the VPS.** In short: `ssh ubuntu@43.133.155.17` works with the owner's own key, no
  password anywhere; CI builds images and **the owner deploys by hand** (`docker compose pull && up` in
  `/home/ubuntu/balitrade`); nothing reaches the VPS automatically.
- **The VPS is real and reachable (2026-11-11):** `ubuntu@43.133.155.17` (Singapore, Ubuntu 24.04, 4 GB, 2 vCPU, swap already on), key-based SSH.
  Layout: `/home/ubuntu/infra` shared nginx owning 80/443 with one file per project in `conf.d/` · `/home/ubuntu/project` the owner's other
  API · `/home/ubuntu/balitrade` this app. All on a shared Docker network `edge`. PostgreSQL 16 native on the host (dev uses 18; nothing in
  the schema depends on the difference), database `balitrade` already migrated through T17 and seeded. Testing domains: `projectbali.my.id`
  (web), `api.projectbali.my.id` (API), `www.` redirects. **This is a testing environment, not production.** Copies of the server files are
  in `deploy/`; the full picture is `docs/ARCHITECTURE.md` §8.
- Deploy plan: CI automatic on GitHub (T22), CD manual over SSH; **PostgreSQL is installed natively on the Ubuntu VPS, not in Docker**; only web
  and api run as containers (`docs/ARCHITECTURE.md` §8). `NEXT_PUBLIC_API_URL` is baked into the web image at build time, so a testing image cannot
  be reused for production — T23 decides between one image per environment and serving the API at `/api` on the same domain.
- **Settled 2026-11-10 (do not reopen without the owner):** one VPS in Singapore holds everything, database included — Supabase and Neon were
  considered and deferred until real money flows, and Vercel was ruled out. The reasoning, the move-later trigger and the managed-Postgres traps
  (Prisma prepared statements vs the transaction pooler, `DIRECT_URL` for migrations, IPv6, sleeping free tiers) are in `ARCHITECTURE.md` §8 and
  `docs/DECISIONS.md`. Two things that follow: 2 GB of swap from day one, and T24's backup restore test is not optional, because `pg_dump` to R2 is
  the only safety net while the database shares a box with the app.
- Many Indonesian home ISPs block outbound port 5432, which is why connecting to a remote Postgres from the owner's home fails (Telkomsel mobile
  works). It never blocks real work: develop against Docker Postgres locally, run production migrations **from the VPS**, and read production data
  over `ssh` + `psql`.
- Footer still links to pages that do not exist (they show the 404 page): `/request`, `/faq`, `/contact`, `/terms`, `/privacy`, `/about`,
  `/seller-guidelines`. `/how-it-works` exists since T16b (with the `#payment` and `#shipping` anchors the footer uses). The navbar links to
  nothing that is missing: it has no text links at all.
- `pnpm docs:api` regenerates `docs/API.md` after route changes.
- **Browser checks (updated 2026-11-06):** the owner has granted Claude in Chrome access, which drives their real Chrome and is now the easiest
  way to check `localhost:3000` — no script needed. Notes: the Claude desktop app's own browser pane is often hidden, and while hidden it cannot
  screenshot or scroll (read it with `get_page_text` / `read_page` instead), and its `resize_window` emulates a viewport, which is how the mobile
  layout was checked; Chrome's `resize_window` did not change what the screenshot showed. Older ad-hoc `puppeteer-core` scripts are not in the repo.
  Login is limited to 5/min, so space out runs.
- **Pattern for checking a role you have no account for:** write a throwaway fixture script in the scratchpad (register through the API so the
  password is hashed properly, then adjust status/products with Prisma), check it in the browser, then delete the account again and confirm the
  row counts are back. Used for the T16c seller dashboard; nothing of it belongs in the repo or in `pnpm db:seed`.

## Open questions (owner decisions still needed)

QC fee per zone (seed values are placeholders) · forbidden-goods list (**the category list itself is no longer a code question since T26** —
the owner edits it at `/admin/categories`) · sourcing fee / deposit /
refund rules · payment details for T17 (see "Waiting on the owner") · seller response deadline and stock reservation ·
exchange-rate buffer. Full list: `docs/BRAINSTORMING.md` section 15 and `docs/DECISIONS.md`.
