# Decision log

Chronological, short. Business decisions are explained in `docs/BRAINSTORMING.md`, technical ones in `docs/ARCHITECTURE.md`; this file is the
quick index (newest first). Add a line whenever a decision is made or changed.

## Technical decisions (made while building, 2026-10-23)

| Decision | Why / detail |
|---|---|
| Password hashing: Node built-in **scrypt** (not argon2/bcrypt) | No native dependency; see `apps/api/src/common/password.ts` |
| Session: JWT in httpOnly cookie `bt_session`, payload `sub` only; user/roles re-read from DB each request | Role changes apply immediately; logout = delete cookie (no revocation) |
| Login 5/min, register 10/min per IP via `@nestjs/throttler` (in-memory) | Needs Redis if the API ever runs more than one instance |
| Public signup may choose BUYER or SELLER; **SELLER only means applicant** | Selling needs `SellerProfile.status = APPROVED`, set by ADMIN_OPS/OWNER. Admin roles only via seed/owner |
| Seller location = `QcZone` (9 Bali regencies); no separate `regency` column | QC fee depends on it. **Fee values are placeholders** |
| Approved sellers cannot change their own location | It drives the QC fee; admin changes it |
| Web calls the API directly from the browser (`NEXT_PUBLIC_API_URL`) with cookies | Web and API must share the same site (subdomains of one domain in production) |
| i18n: next-intl, `/en /id /ru` URLs, cookie `NEXT_LOCALE`, saved to `User.locale` | ID/RU texts were written by AI → have a native speaker review before release |
| API errors stay English; the UI maps HTTP status to translated messages (`errorKey`) | Never show raw API text to users |
| Media: browser uploads straight to R2 via presigned PUT; two buckets (public product media, private files) | Type and exact size are part of the signature; photo ≤ 10 MB, video ≤ 50 MB |
| R2 settings optional in development (media endpoints answer 503), **required in production** | App refuses to start with a partial config |
| Product statuses change only through `nextStatus()`; editing an APPROVED product sends it back to review | See `docs/ARCHITECTURE.md` §5 |
| Approving a product requires en + id + ru text (manual translation by admin) | Automatic translation is MVP 1.1 |
| Public catalog shows only APPROVED products of APPROVED sellers; falls back to the seller's language | `GET /api/products?locale=`; T12 extends it |
| Product categories and units are fixed lists in `packages/shared/src/product.ts` | Final list + forbidden goods still open |
| Exchange rate (T11): append-only `ExchangeRate` table (newest row = in force), only ADMIN_OWNER sets it, bounds 1,000–100,000 IDR/USD | Table doubles as history/audit. Catalog `priceUsd` = IDR ÷ rate, half-up to cents, `null` until a rate exists. **No 2–3% buffer yet** (open) |
| Public catalog (T12): list/detail/seller page return 404 for anything not APPROVED (product and seller); search = every word must match title/description in any language; max 48 results, no pagination yet | Seller page exposes no email/contact/rating. QC fee not shown on product detail until the zone tariff is decided. Buy/Ask buttons are disabled for logged-in users until T13/T15 |
| AI context lives in `AGENTS.md` + `CLAUDE.md` + `.claude/skills` only (2026-10-30): `.kiro` removed; project docs moved into `docs/` (`ARCHITECTURE`, `BRAINSTORMING`, `DESIGN` (slimmed from `UI_PROMPT.md`), `API`, `SECURITY`) | Less context per session; `UI_PROMPT.md` was 98 KB. Old prompts stay in git history. Keep `docs/API.md` in sync with routes |
| Security hardening (2026-10-30): `helmet` on the API, basic headers on the web app, `@nestjs/platform-express` 12.2.0 → 12.3.2 and `body-parser` 2.4.0 (audit clean), install scripts of `@swc/core` and `@parcel/watcher` denied | See `docs/SECURITY.md` for what is still open. No CSP yet |
| List endpoints skip rows whose relation vanished between two reads instead of answering 500 | Found by parallel e2e specs deleting test users; Prisma `relationLoadStrategy: 'join'` was tried but its types rejected these queries |
| Payment methods (2026-10-30): `BANK_IDR` (BCA), `USDT` (Binance wallet), `EXCHANGE` (rubles via a partner exchange in Indonesia that sends rupiah to BaliTrade manually); all verified manually by ADMIN_FINANCE | Replaces the 2-method assumption in the Stitch design (07-b). Built in T17/T19, no code exists yet. See `docs/BRAINSTORMING.md` §11 for the risk note on EXCHANGE |
| Admin area gets its own layout (2026-10-30): dark-teal left sidebar, no storefront navbar/footer, menu by admin role. Built as task T17b, after T17 | Owner finds one shared look confusing to test and needs many admin menus. Chosen over a light sidebar and an icon rail. Spec in `docs/DESIGN.md` |
| Chat (T13): no Participant table; participants are the conversation's buyer and seller, and ADMIN_OPS / ADMIN_OWNER take part in every conversation through their role (finance does not). One inquiry per buyer and product | Admins added later join automatically; non-participants get 404. Replaces the Participant model in ARCHITECTURE §5 |
| Chat UI first with polling (2026-10-30): messages refresh every 4 s while the tab is visible; Socket.IO replaces polling later in T13 | Gets a demo-able chat without new dependencies; the REST API stays the source of truth. Only buyers see the "Ask" button, admins and sellers use the inbox |
| Home page (2026-10-30): links only to pages that exist (`/products`, `/register?role=seller`); the request banner and QC preview wait for their pages. Hero search is a plain GET form to `/{locale}/products?q=` | Navbar/footer still point to missing pages (`/request`, `/how-it-works`, `/faq`, `/contact`, `/terms`, `/privacy`, `/about`, `/seller-guidelines`) which show the 404 page |
| `useAuth()` returns "loading" during hydration; chat and inbox refresh immediately when the tab becomes visible again | Fixed a hydration mismatch in the navbar (found on the heavier home page) and stale messages after switching tabs |
| Deploy (2026-10-31): CI automatic on GitHub, CD manual over SSH; Ubuntu 22.04/24.04 VPS; PostgreSQL is installed **natively on the VPS** (not in Docker) and only the web and API run as containers, connecting to the host database; MVP 1.0 is finished locally first, then uploaded to the VPS. The dev database may be reset at any time | Owner installs and manages Postgres by hand (`psql`, `pg_dump`); local development still uses the Docker Postgres. The API container needs the host address (`host.docker.internal`) and Postgres must not listen on the public interface. `NEXT_PUBLIC_API_URL` is baked into the web image at build time. Tasks T22/T23 in `TASKS.md` updated |
| Chat realtime (2026-10-31): Socket.IO pushes, REST writes. Auth in a handshake middleware (cookie + Origin), rooms only for participants, `conversation:updated` carries an id only, 20 messages/min per user in memory | New dependencies: `socket.io` 4.8.4, `socket.io-client` 4.8.4, `@nestjs/websockets` + `@nestjs/platform-socket.io` 12.3.2; `@nestjs/common`/`core`/`testing` raised to 12.3.2 to match. Polling stays as a slower safety net |
| Notifications (T14): chat notifications go to the other side of a conversation, admins are not notified (they use the inbox); unread messages of one conversation fold into one row with a counter; pushes go to the owner's private socket room. Bell lives in one navbar instance | Keeps the list short and the badge meaningful. Order events reuse the table with new `NotificationType` values |
| Sign-up consent (2026-10-31): the API requires `acceptAdminInChat: true` and stores `adminChatConsentAt` + a wording version | Privacy-law transparency about the admin in all chats; the chat itself does not check the consent yet (older and seed accounts have none) |
| Orders (T15): the order copies price, exchange rate and QC fee; the USD unit price is rounded to cents first and the total is qty × that; ordering is refused (409) while no exchange rate is set; one item per order; seller never receives the delivery address; every admin role (incl. finance) can see all orders; 20 requests per buyer per hour | Prices must not change under an existing order. The order chat has no product (`productId` null, linked by `orderId`) so it does not clash with the one-inquiry-per-product rule. The QC fee shown uses the placeholder zone tariff |
| System chat messages (T15): `MessageKind.SYSTEM`, no author, shown as a centered note; they create no chat notification (the order has its own) | `Message.senderId` is now optional |
| Order actions (T16): the seller can only propose a *lower* quantity; accept goes straight to AWAITING_PAYMENT (ACCEPTED is kept for the MVP 1.1 cart); the buyer can cancel until paying; the seller can revise or withdraw a proposal; admins read orders but cannot act on them; concurrent answers resolve with one winner and a 409 | Transitions live in one shared function (`nextOrderStatus`). No seller response deadline and no stock reservation yet (still open) |
| Dependencies pinned to exact versions; very new packages are added to `minimumReleaseAgeExclude` | Currently the AWS SDK |

## Open questions (need the owner)

- QC fee per zone (current seed values are placeholders).
- Final product category list and the forbidden-goods list.
- Sourcing fee, deposit and refund rules.
- A deadline for the seller to answer an order request, and whether stock is held while an order waits (T16 has neither).
- Payment details still to come from the owner: USDT network and Binance wallet address, BCA account details, the partner exchange and the instructions shown to buyers, and whether EXCHANGE buyers need an amount in rubles.
- Exchange-rate buffer (2–3% for rate risk) and how long a USD price stays locked at checkout.
- Separate private R2 bucket before real payment proofs/QC files (dev currently uses one bucket, `eksportir-testing`, for both).
- Native-speaker review of the Indonesian and Russian UI texts.

## Earlier decisions

Business and design decisions from the brainstorming phase (2026-10-17 → 2026-10-22: cart vs buy-now, no product variants in the MVP,
seller confirmation before payment, chat in English with the admin in every chat, QC per seller, payment methods, stack choice, MVP 1.0 vs 1.1 scope)
are recorded in `docs/BRAINSTORMING.md` (sections 5a and 15) and `docs/ARCHITECTURE.md`.
