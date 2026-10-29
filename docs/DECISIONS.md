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
| Dependencies pinned to exact versions; very new packages are added to `minimumReleaseAgeExclude` | Currently the AWS SDK |

## Open questions (need the owner)

- QC fee per zone (current seed values are placeholders).
- Final product category list and the forbidden-goods list.
- Sourcing fee, deposit and refund rules.
- Payment details still to come from the owner: USDT network and Binance wallet address, BCA account details, the partner exchange and the instructions shown to buyers, and whether EXCHANGE buyers need an amount in rubles.
- Exchange-rate buffer (2–3% for rate risk) and how long a USD price stays locked at checkout.
- Separate private R2 bucket before real payment proofs/QC files (dev currently uses one bucket, `eksportir-testing`, for both).
- Native-speaker review of the Indonesian and Russian UI texts.

## Earlier decisions

Business and design decisions from the brainstorming phase (2026-10-17 → 2026-10-22: cart vs buy-now, no product variants in the MVP,
seller confirmation before payment, chat in English with the admin in every chat, QC per seller, payment methods, stack choice, MVP 1.0 vs 1.1 scope)
are recorded in `docs/BRAINSTORMING.md` (sections 5a and 15) and `docs/ARCHITECTURE.md`.
