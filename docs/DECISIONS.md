# Decision log

Chronological, short. Business decisions are explained in `BRAINSTORMING.md`, technical ones in `ARCHITECTURE.md`; this file is the
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
| Product statuses change only through `nextStatus()`; editing an APPROVED product sends it back to review | See `ARCHITECTURE.md` §5 |
| Approving a product requires en + id + ru text (manual translation by admin) | Automatic translation is MVP 1.1 |
| Public catalog shows only APPROVED products of APPROVED sellers; falls back to the seller's language | `GET /api/products?locale=`; T12 extends it |
| Product categories and units are fixed lists in `packages/shared/src/product.ts` | Final list + forbidden goods still open |
| Dependencies pinned to exact versions; very new packages are added to `minimumReleaseAgeExclude` | Currently the AWS SDK |

## Open questions (need the owner)

- QC fee per zone (current seed values are placeholders).
- Final product category list and the forbidden-goods list.
- Sourcing fee, deposit and refund rules.
- Cloudflare R2 credentials (blocks ticking T08).
- Native-speaker review of the Indonesian and Russian UI texts.

## Earlier decisions

Business and design decisions from the brainstorming phase (2026-10-17 → 2026-10-22: cart vs buy-now, no product variants in the MVP,
seller confirmation before payment, chat in English with the admin in every chat, QC per seller, payment methods, stack choice, MVP 1.0 vs 1.1 scope)
are recorded in `BRAINSTORMING.md` (sections 5a and 15) and `ARCHITECTURE.md`.
