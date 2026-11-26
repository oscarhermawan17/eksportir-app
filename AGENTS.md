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
- Visual source of truth for UI: **"Design system v2" in `docs/DESIGN.md`** (since 2026-11-26; tokens in `apps/web/src/app/globals.css`,
  typeface in `apps/web/src/app/fonts.ts` only). The old `design-ui/google-stitch/01-v4.html` look (cream, teal, gold) is retired.
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
`pnpm --filter @balitrade/api test:e2e` (needs `pnpm db:up` + `pnpm db:test:prepare`), `pnpm db:migrate`, `pnpm db:seed`,
`pnpm db:pull` (local database ← copy of the testing server's).
Setup steps are in `README.md`. Env files: `apps/api/.env`, root `.env` (from the `.env.example` files).

## Where to read more

| File | Content | Read when |
|---|---|---|
| `TASKS.md` | Ordered task list (T01–T25) with DoD and status ticks | Always, first |
| `docs/ARCHITECTURE.md` | Stack, roles/RBAC, data model, order status flow, MVP scope, decisions, R2 setup | Before backend/db work |
| `docs/BRAINSTORMING.md` | Business model, flows, open decisions (section 15) | Before product/flow decisions |
| `docs/DESIGN.md` | Design system, per-page screen specs and "Catatan implementasi" (what NOT to copy from the designs) | Before UI work |
| `design-ui/google-stitch/*.html` | Reference designs for flows only (the `01-v4.html` look is retired) | UI work |
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
- **A page you navigate away from stays mounted, only hidden** (Next.js 16 / React Activity — the old page sits in the DOM under
  `display: none` so going back is instant). It is not unmounted, so **nothing resets by itself**: uncontrolled inputs keep their typed
  values, `useRef` keeps its contents, and a `busy` flag left `true` leaves buttons disabled forever. A form that creates something must
  therefore empty itself after a successful save (`form.reset()`, the controlled bits back to their defaults, refs cleared, child
  components that own state remounted through a `key`), and every `setBusy(false)` belongs in a `finally`. An **open `<dialog>` stays open**
  too, and its mount effect runs **again** when the page is shown, so a dialog the user leaves through one of its own links must close itself
  and call its page's `onClose` **directly** — the `close` event never reaches a page that is already hidden. All of this was found and fixed
  on 2026-11-13 in the seller product form, the login and sign-up forms (logging out left nobody able to log in again) and the order dialog;
  the admin screens were checked and were already safe. `pnpm dev` hot-reloads the fix, but the stale hidden page survives it — reload the
  tab before judging.
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
  `adminprod-e2e-`, `fx-e2e-`, `catalog-e2e-`, `chat-e2e-`, `chatrt-e2e-`, `notif-e2e-`, `orders-e2e-`, `orderact-e2e-`, `qc-e2e-`, `ship-e2e-`, `done-e2e-`, `payout-e2e-`, `content-e2e-`); never share a prefix between files (they run in parallel). Presigned R2 URLs are computed offline, so tests use fake R2 env.
- Browser checks: headless Chrome via `puppeteer-core` works well (`/Applications/Google Chrome.app`). Delete test accounts afterwards.
- `pnpm add` of very recent packages may add them to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (already done for the AWS SDK).
- Seed data: `pnpm db:seed` creates the admin from `ADMIN_*` env and the 9 Bali QC zones (fees are **placeholders**).

## Current status

Update this block at the end of every task (the `[x]` ticks in `TASKS.md` stay the source of truth). Last handoff: **2026-11-26**,
29 of 34 tasks done (T01–T20, T13b, T16b, T16c, T17b, T22, T23, T26, T27 and T28). Open: T21 password reset, T24 backup, T25 end-to-end
test, T29 seller↔admin chat, T30 switch off `r2.dev`, T31 buyer credit.

**Deployed 2026-11-26 (fifth deploy of the day): payment accounts managed by the OWNER — commit `b0cae51` is live.** The first
CI run (#45723285628) failed: CI had no `PAY_*` values, so the new destination check refused every e2e payment (400); the e2e step now
gets the `.env.example` placeholders, run #45723970140 green. Dump first (`~/db-backups/balitrade-2026-11-26-pre-payment-settings.dump`,
76 KB), migration `20261126140000_payment_settings`, then images: api `6195c43b` → `46cc9c22`, web `28fa8cbf` → `a2d8cc9a`. Verified
from outside: `database: up`; `/id`, `/id/how-it-works`, `/en/admin/payment-settings` and `/en/admin/payments` 200; `GET`/`PUT
/api/admin/payment-settings` answer 401 without a session; the catalog still answers. `payment_settings` is still empty there, so buyers
see the env placeholders until the owner saves the page. Not opened while logged in on the live site.
**Redeployed the same day: commit `5997292`.** The owner's first save was refused ("does not fit the chosen network"): before the first
save the form was prefilled with the env USDT address, a placeholder that is not a valid TRC20 address. The form now leaves an invalid env
address out and names the network an address fits (`usdtAddressFamily()` in `packages/shared`). CI run #45725370381 green, dump
`~/db-backups/balitrade-2026-11-26-pre-usdt-fix.dump` (78 KB), no migration, images api `46cc9c22` → `800b90da`, web `a2d8cc9a` →
`db70c63e`; `database: up`, the page 200, the settings API 401 without a session.

**Payment accounts managed by the OWNER (2026-11-26).** `/admin/payment-settings` (menu "Payment accounts";
OWNER saves, FINANCE reads) holds the bank account and the USDT (Binance) deposit address buyers pay to; every save is audited with
masked values, both are typed twice, the address is checked against its network, and each payment now keeps `destination`. Until the
first save the `PAY_*` env values stay in force; the exchange method is env-only and, while `PAY_MOCK=true`, keeps the buyer's test
warning on (the page says so). The owner enters the real bank and USDT details on that page; the exchange stays in env.

**Deployed 2026-11-26 (fourth deploy of the day): editable How it works content — commit `3fb9560` is live.** CI run
#45717818400 green. Dump first (`~/db-backups/balitrade-2026-11-26-pre-content.dump`, 72 KB), then migration
`20261126120000_content_items` (created the table and seeded 6 steps + 5 questions), then images: api `74300919` → `6195c43b`, web
`fd82f7e4` → `28fa8cbf`. Verified from outside: `database: up`; `/id`, `/id/how-it-works`, `/ru/how-it-works`, `/en/admin/content` 200;
`/api/content` serves the same 6 steps (id/ru) and 5 questions; `/api/admin/content` answers 401 without a session; the rendered page
shows 6 steps and 5 questions with no horizontal overflow. The admin screen was not opened while logged in on the live site.

**Editable How it works content (2026-11-26).** The six steps and five questions of `/how-it-works` now live in
the `content_items` table (migration `20261126120000_content_items` creates it **and seeds the current texts** in en/id/ru) and are
edited by the OWNER on `/admin/content` (menu "Page content"). Steps render as a vertical numbered timeline, questions as an accordion.
The old `HowItWorks.steps/faq` message keys are gone. Deploy order as always: backup, migration, images.

**Deployed 2026-11-26 (third deploy of the day): T27 — commit `7364109` is live.** CI run #45713422152 green. Dump first
(`~/db-backups/balitrade-2026-11-26-pre-t27.dump`, 72 KB), no migration, then images: api `c5107563` → `74300919`, web `296c4f1b` →
`fd82f7e4`. Verified from outside: `database: up`; `/id`, `/id/seller`, `/en/admin`, `/en/admin/payments`, `/en/admin/sellers`,
`/en/admin/orders` and `/en/admin/products` all 200; the paged `/api/admin/payments` and `/api/admin/sellers` answer 401 without a
session; 7 products. Not opened while logged in on the live site — the owner checks the two tables.

**T27 done 2026-11-26:** Payments and Sellers joined Listings and Orders on the shared admin table. Both APIs are
paged on the server (`AdminListQueryDto` in `apps/api/src/common/`: `q`, `from`/`to` as Bali days, `page`, `size`) and return
`statusCounts`; the payments list lost its silent `take: 200`. Rows **open in place** (`DataTable` `expand`): a payment shows its proof
(signed URL fetched on opening) beside the amount and the Verify / Reject buttons, a seller application shows contact, location, QC fee
and the Approve / Reject / Revoke buttons. `escapeLike` now lives once in `apps/api/src/common/escape-like.ts`. Checked in the browser with
temporary local fixtures (a pending seller, a submitted payment), deleted afterwards together with the chat message and notification the
rejection wrote; the proof image itself was not seen, since no file was uploaded to the shared private bucket for the check.

**Deployed 2026-11-26: the UI revamp (design system v2), category icons, Bali-day admin date filters and Next.js 16.4.6 — commit
`2089841` is live.** Design system v2 (navy on white, IBM Plex Sans, no shadows or all-caps labels; `docs/DESIGN.md`) covers the navbar,
footer, `/` (with a CC BY 2.0 placeholder photo banner, credits in `apps/web/src/assets/banners/CREDITS.md`), `/products/:id`,
`/how-it-works`, login/sign-up and the whole admin and seller areas, including the order detail panels buyers share. Still to do: the
buyer `/orders` list and payment page get a look of their own later. CI run #45691008522 green. Dump first
(`~/db-backups/balitrade-2026-11-26-pre-ui-v2.dump`, 72 KB — smaller than the pre-T20 dump but every table's row count matches), then
migration `20261126100000_category_icon` (one nullable column), then images: api `cfb44927` → `ff2ffe91`, web `4758f0f1` → `a1f4c05f`.
Verified from outside: `database: up`; `/id`, `/en`, `/ru`, `/id/how-it-works`, `/id/login`, `/id/register`, `/id/seller`,
`/id/seller/orders`, `/en/admin` and `/en/admin/categories` all 200; IBM Plex Sans served, the banner loads through `/_next/image`,
8/8 images load, no horizontal overflow, 7 products, no `r2.dev`; an icon change without a session answers 401. **Waiting on the
owner:** pick icons for the four live categories on `/admin/categories` (they read `null` = default until then).
**Three deploy facts learned this time:** the owner's SSH key lives only in the Windows SSH agent, so `ssh balitrade` works from
PowerShell and not from Git Bash; the BOM PowerShell adds breaks a first-line comment that contains `(`, so the first line is now a
throwaway word (`bom-guard-line-ignore-the-error`); and the server `.env`'s `DATABASE_URL` points at the Docker bridge (`172.19.0.1`),
so `pg_dump` run on the host must swap the host for `127.0.0.1` (done inside the command, the URL is never printed).
**Deployed 2026-11-26 (second deploy of the day): the admin tables — commit `a6c1545` is live.** Listings, orders and the
QC/shipping/payout queues got status tabs with counts, a react-day-picker date popover with presets and clickable rows; the API gained a
multi-status filter and `statusCounts` (no migration). CI run #45708549535 green. Dump first
(`~/db-backups/balitrade-2026-11-26-pre-admin-tables.dump`, 72 KB), then images: api `ff2ffe91` → `c5107563`, web `a1f4c05f` →
`296c4f1b`. Verified from outside: `database: up`; `/id`, `/id/seller`, `/en/admin/orders`, `/en/admin/products`, `/en/admin/qc`,
`/en/admin/shipping` and `/en/admin/payouts` all 200; `/api/admin/orders?status=REQUESTED,COMPLETED` and `/api/admin/products` answer
401 without a session; 7 products, 8/8 home images load. The new tables were not opened while logged in on the live site (no
password is typed into a tool) — the owner checks them.
For browser checks use the globally installed `agent-browser` CLI (`agent-browser skills get core`); for admin/seller screens on
localhost mint a session from the laptop's `JWT_SECRET` for an existing local user instead of typing a password.

**Deployed 2026-11-23: T20 completion + payouts (commit `ae5c1a3`) is live.** An order now runs from REQUESTED to COMPLETED. CI run
#45194927728 green. Dump first (`~/db-backups/balitrade-2026-11-23-pre-t20.dump`, 116 KB), then **two** migrations before the new
images: `20261121095745_completion_payouts` (enum value `DELIVERY_ISSUE`, `orders.commission_rate` defaulting to 1% — the one live
order got 0.0100 — and four new tables) and `20261121095958_payout_notification` (enum value `PAYOUT_RECORDED`). Digests api `a7d34181`
→ `cfb44927`, web `8db0f2a5` → `4758f0f1`. Verified from outside: `database: up`; `/id`, `/id/login`, `/id/seller`,
`/id/seller/account`, `/en/admin`, `/id/admin/payouts` and `/id/admin/shipping` all 200; the eight new routes answer 401 without a
session; the catalog still has 7 products and no `r2.dev`. Not exercised while logged in on the live site: the one live order is still
REQUESTED. On the order page: `OrderCompletionPanel` (buyer confirm / report, OWNER complete) and `OrderPayoutPanel` (seller and
FINANCE/OWNER only); the seller's bank card is on `/seller/account`; the payout queue is `/admin/payouts`. The browser check used the
app's Terminal panel to run `pnpm dev` (`run_in_terminal`): a dev server started there is the owner's shell, so Next.js does not stop it.

**Deployed 2026-11-20 (second deploy of the day): T19 shipping + tracking (commit `dbfd343`) is live.** CI run #44741526837
green. Dump first (`~/db-backups/balitrade-2026-11-20-pre-t19.dump`, 104 KB), then migration `20261120113922_shipping_tracking` (two
tables + one enum, no data moved) before the new images. Digests api `c2f300a7` → `a7d34181`, web `be119bb6` → `8db0f2a5`. Verified from
outside: `database: up`; `/id`, `/id/login`, `/id/seller`, `/en/admin`, `/id/admin/qc` and `/id/admin/shipping` all 200; the five new
routes answer 401 without a session; the catalog still has 7 products and no `r2.dev`. Not exercised while logged in on the live site:
no live order is past REQUESTED yet. On the order
page: `OrderShippingPanel` (bill, shipping money, OPS bill form, FINANCE "shipping is paid"; never rendered for the seller) and
`OrderTrackingPanel` (timeline for all three, OPS milestone form). OPS's queue is `/admin/shipping`. `pay-order.tsx` now follows
`PaymentSummary.purpose`, so one payment page serves goods and shipping. An order ends at `ARRIVED`; `COMPLETED` and payouts are T20.

**Deployed 2026-11-20: T18 QC (commit `3b0c5fe`) is live.** CI run #44727262395 green. The database was dumped first to
`~/db-backups/balitrade-2026-11-20-pre-t18.dump` on the VPS (93 KB, chmod 600), then migration `20261120104104_qc_reports` (two new
tables, no data moved) was applied **before** the new images, as `docs/DEPLOY.md` §3 says. Image digests api `f114774b` → `c2f300a7`,
web `12ec5c2a` → `be119bb6`; this time `docker compose up -d` returned normally. Verified from outside: `database: up`, `/id`, `/id/login`,
`/id/seller`, `/en/admin` and `/id/admin/qc` all 200, the QC routes answer 401 without a session, the catalog still answers its 7 products
and no `r2.dev` link. **QC was not exercised while logged in on the live site** — no order there has reached `IN_QC` yet (the one live
order is REQUESTED). The QC report lives on the order page for all three sides (`OrderQcPanel`); OPS's queue is `/admin/qc`. Approval
stops at `QC_APPROVED`: the shipping bill is T19.
**Trap found while deploying from Windows:** piping a script from PowerShell into `ssh … "bash -s"` prepends a byte-order mark, so the
script's first line fails ("command not found") — and when that line was `DB=$(grep … .env …)` the error echoed the database URL,
password included. Make the first line a comment.

**Deployed 2026-11-15 (second deploy of the day):** commit `c22ec5e` is live. An order's `OrderItem.title` snapshot was frozen in the
**buyer's** language, so a Russian buyer left the Bali seller reading "50 × Благовония" in `/seller/orders`. It is now always English
(`titleIn('en')`, falling back to the listing's `sourceLocale`), and so is the system message that opens the order chat. The relation and
the price snapshot were never the problem — `productId` and the frozen prices are unchanged. Seller notifications still speak the seller's
language on purpose. The one live row (OR-1538) and its chat message were rewritten by hand on the VPS; the dev database had nothing to
repair. CI run #18 green on all three jobs, **no migration** (the schema change is a doc comment). Image digests web `bcf5cacb` →
`12ec5c2a`, api `f6ae48dc` → `f114774b`; both containers recreated and this time the SSH session returned normally. Verified from outside:
`database: up`, `/id`, `/id/seller` and `/id/login` all 200, the catalog still answers its 7 products, and OR-1538 now reads "Incense" in
both the order row and the order chat.

**Two environment facts learned while pushing this:** GitHub over **SSH port 22 times out from the owner's home ISP** (the same family of
block as port 5432, already noted below) — `git push` hangs and then dies with `ssh_dispatch_run_fatal`. `ssh.github.com:443` works, so the
push went through `git push ssh://git@ssh.github.com:443/oscarhermawan17/eksportir-app.git main`; adding that host to `~/.ssh/config` would
make `git push origin main` work again. And **`gh` is not installed on this laptop**: read workflow runs with the unauthenticated API call in
`docs/DEPLOY.md` §7 instead.

**Deployed 2026-11-15:** commit `7c78ad3` is live on the VPS — the mobile navbar (two rows, one auth button), the catalog grid (2/3/4/5 columns, container 1280px) and the compact product cards. CI run #16 green, no migration. Image digests web `05b36319` → `bcf5cacb`, api `3a348de0` → `f6ae48dc`. Checked from outside at 1440px and 375px: 5 and 2 columns, no horizontal overflow, cards 253px tall on a phone, badges on the photos, no MOQ and no seller regency on a card. **Note the SSH trap in `docs/DEPLOY.md` is real:** `docker compose up -d` finished and recreated both containers, then the SSH session hung without returning — check `docker ps` rather than assuming it failed.

**Deployed 2026-11-14:** commit `1638f95` (T28, the seller area) is live on the VPS. CI run #14 green, `docker compose pull && up -d`,
**no migration** — T28 changed no schema. Verified from outside: `/id/seller`, `/id/seller/orders`, `/id/seller/products` and
`/id/seller/account` all answer 200 (an unknown URL still 404s, and `/id/seller/orders` serves its own title "Pesanan — BaliTrade", so the
new build really is the one being served), the catalog still returns its 7 products with USD prices, and the API reports `database: up`.
Image digests before → after: web `206bba4e` → `05b36319`, api `6ce3519d` → `3a348de0` (for a rollback, pin `IMAGE_TAG` in the server's
`.env`). **The seller area itself was not exercised while logged in on the live site** — that needs an account there, and no password was
typed into a tool call.
Previously deployed 2026-11-13: commit `f61e198`, the four forms that did not reset themselves (seller product, login, sign-up, order
dialog; see the hidden-page gotcha below and `docs/DECISIONS.md`).

**Done**
- Foundation and accounts: T01 monorepo · T02 database · T03 auth · T04 RBAC · T05 layout · T06 i18n (en/id/ru) · T07 seller onboarding.
- Products: T08 R2 upload · T09 seller CRUD · T10 admin review + manual translations · T11 manual USD/IDR rate (owner, `/admin/exchange-rate`) ·
  T12 public catalog (`/sellers/[id]`, search + filters; the catalog itself lives at `/` since T16b, detail at `/products/[id]`).
- Chat and notifications: T13 chat over Socket.IO (drawer on the product page, `/messages` inbox; text only, attachments moved to MVP 1.1) ·
  T13b admin-in-chat consent stored at sign-up · T14 in-app notifications (bell in the navbar, live).
- Orders: T15 request (dialog on the product page, `/orders` list and detail, order chat, seller notification) · T16 responses (seller accepts /
  declines / proposes a *lower* quantity; buyer accepts the change or cancels; each step = system message in the order chat + notification).
  All transitions live in `nextOrderStatus()` in `packages/shared/src/orders.ts`.
- T28 **the seller area has its own chrome** (2026-11-14): route group `(seller)` beside `(admin)` and `(shop)`, so the URLs are unchanged.
  A **light** sidebar on `lg`+ (deliberately not the admin's dark teal) and a **bottom tab bar** below it instead of a drawer, because sellers
  work on phones; menu in `SELLER_NAV` (`src/components/seller/seller-nav.ts`): Dashboard · Orders · Products · Chat with BaliTrade (disabled,
  "soon" — that is T29) · Shop profile. The top bar is the only page title, so pages here write no `h1`. `/seller/orders` reuses `OrdersList`
  and `OrderDetail` through `basePath`, and `ordersBasePathFor()` sends every order link to the right area; `/orders` still works for everyone.
  The dashboard was rewritten around work waiting: two rows of tiles, the orders that need an answer, the latest listings, and a card for an
  unfinished profile. Counting rules are pure functions in `src/lib/seller-stats.ts` — including the fix that **"live in the catalog" is
  `APPROVED && categoryActive`**, not `APPROVED` alone. **No earnings or "items sold" tile**: there is no commission and no `Payout` before T20,
  and an order total is not the seller's money. The products page got search and status chips (URL state via `useTableQuery`) and rows that
  reflow to cards below `md`. Sellers can now set their own phone (`PATCH /api/auth/me`, stored on `User`, never public).
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

> **Right now the owner is working on the UI** (polish, making it attractive) — 2026-11-14. Finish or hand back UI work before
> starting a task from this list. T28 (seller area) is done; **T29 seller↔admin chat** is the follow-up it created and is not started. **T21 password reset is marked URGENT** in `TASKS.md` (nothing resets a forgotten password today
> and sessions expire after 7 days), but the owner has deliberately put it **after** the UI work.

0. **T24 backup** is now the most valuable unfinished task, not the next one in number order: the database shares
   a box with the app, so `pg_dump` to R2 **with a restore actually tried once** is the only thing standing between
   a dead disk and losing every order record. It also owns the rest of `docs/DEPLOY.md`'s open checklist.
1. **T21 password reset** (URGENT in `TASKS.md`) and **T24 backup** before any real user. T31 buyer credit builds on T20's payout and
   audit tables.
2. Then T25 end-to-end test: the whole flow now runs from REQUESTED to COMPLETED.
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
- **The dev database is a copy of the testing server's (since 2026-11-20).** `pnpm db:pull` replaces the local Docker
  database with a `pg_dump` of the VPS (read only on the server), so accounts and passwords are the testing site's —
  including the admin's, which is the VPS one, not `ADMIN_PASSWORD` from the laptop `.env`. Pull again whenever the
  testers' latest data matters; it wipes local-only rows. Locally, `pnpm db:migrate` and `pnpm db:seed` are safe again.
  **E2E runs only against `balitrade_test`** (`pnpm db:test:prepare`, migrated + seeded like CI): `vitest.config.e2e.ts`
  refuses to start outside CI unless `E2E_DATABASE_URL` is a local `*_test` database. The Windows laptop also has
  another project's Postgres on 5433, so the optional VPS tunnel (`ssh -N balitrade-db`) uses 5434.
- **T26 is live on the VPS (2026-11-12):** migration applied, image deployed, `/api/categories` answers from the
  database. **The VPS categories are deliberately NOT the seeded nine** — the owner replaced them with four:
  `PERSONAL_GOODS`, `GARMENTS_FASHION`, `LEATHER_PRODUCTS`, `HANDICRAFT_SOUVENIR` (labels in en/id/ru in the row).
  The nine were deleted outright, which was safe only because `products = 0` there. **`pnpm db:seed` would put the
  nine back** (`SEED_PRODUCT_CATEGORIES` in `packages/shared`), so do not run the seed against the VPS.
- **The VPS database is small but no longer empty.** Measured 2026-11-14: `users=4, sellers=3 (all APPROVED:
  Test Seller/Tabanan, Seller 1 Denpasar, Crafted Karangasem), products=7 (all APPROVED), orders=0, categories=4`.
  The owner has been filling it by hand since 2026-11-11, when it held only the admin, the 9 QC zones from
  `pnpm db:seed` and the rate (Rp 18,150 / USD). **Orders are still 0**, so anything that counts order work —
  the T28 seller dashboard's "needs your attention" row, for one — reads 0 there until somebody places one.
  The 12 sample products and "Oscar Testing" seller exist only in the
  local dev database — they came from a throwaway script that was deliberately never committed. The owner is
  filling the testing site by hand through the UI, which also exercises R2 uploads over real HTTPS, cookies on a
  real domain and the chat WebSocket through nginx — none of which localhost tests.
- The admin on the VPS is `admin@balitrade.local`; its password is in `/home/ubuntu/balitrade/.env`. It was the
  public `.env.example` placeholder until 2026-11-11 (the seed read the laptop's `.env`), which on a public repo
  meant anyone could sign in as admin. **Never seed a reachable environment with placeholder credentials.**
- Sample data (2026-11-06, dev only): 12 approved products on the "Oscar Testing" seller across 7 categories, $2.49–$132.60, plus the Rp 18,100
  rate. Their photos are **generated placeholders** labelled "BaliTrade sample", not real product photos, and their id/ru texts are AI-written.
  The throwaway script is not in the repo; `pnpm db:seed` does not create them.
- **R2: two buckets, two tokens, and a CORS policy per origin (done 2026-11-12).** `eksportir-testing` is public
  (product photos, served from `https://media.projectbali.my.id` since 2026-11-18, because `r2.dev` did not load on
  Telkomsel; see `docs/DEPLOY.md` §3c); `eksportir-private` has no public URL and holds payment proofs and
  QC files. Each has its own API token scoped to it alone, so the key that signs every photo upload cannot read a
  payment proof — proven with a 403. **Uploads go browser → R2 directly, so every bucket needs a CORS policy naming
  each origin the site is served from**; the exact policies in force are in `docs/DEPLOY.md` §3b. A missing origin
  shows up as a bare 403 on upload, only on the deployed site — that cost an afternoon on 2026-11-12.
  **Adding the production domain later means updating CORS on both buckets.**
- **https://projectbali.my.id is a DEVELOPMENT environment, not production (restated by the owner 2026-11-12).**
  The production domain has not been chosen yet. What makes it different from a laptop is only that **the whole
  team can see it** — so it holds no real customer data, its data may be wiped, and a rough edge there is not an
  outage. Two things follow: do not treat its database as precious *yet* (T24 is still what makes it precious),
  and do not put anything there that would embarrass the team if a stranger found the URL. When the real domain
  is chosen, this box becomes staging and a separate production environment is set up — at which point the
  shared R2 bucket and the shared database both have to be split.
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
