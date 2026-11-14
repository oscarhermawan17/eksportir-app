# Security

What is in place, what is still open, and what must happen before real users or money. Last reviewed **2026-10-30**.
Rules for working with secrets are in `AGENTS.md` (never print or commit them); data model and roles are in `docs/ARCHITECTURE.md`.

## In place (verified)

| Area | What the code does |
|---|---|
| Passwords | Node built-in `scrypt`, never stored or logged in plain text (`apps/api/src/common/password.ts`) |
| Sessions | JWT in an httpOnly cookie `bt_session` (`sameSite=lax`, `secure` when `NODE_ENV=production`); the token holds only `sub`, roles are re-read from the database on every request |
| Access control | `JwtAuthGuard` + `RolesGuard` (+ `ApprovedSellerGuard`); admin roles never come from public sign-up; another user's resource answers 404. Every route and its access is listed in `docs/API.md` |
| Input | Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), DTOs for all input; the client never decides price, status or role; search text is escaped so `%` and `_` are plain characters |
| Brute force | Login 5/min and register 10/min per IP (`@nestjs/throttler`, in-memory) |
| Headers | API: `helmet` (tested in `test/security.e2e-spec.ts`); web: nosniff, frame, referrer and permissions policy, no `X-Powered-By` (`apps/web/next.config.ts`) |
| CORS | Only `WEB_ORIGIN`, with credentials |
| Orders | Every order route filters by the logged-in user (buyer, seller of the order, or an admin role), others get 404; the buyer's delivery address is never sent to the seller; order requests are limited to 20 per buyer per hour; price, rate and fee are copied into the order on the server (the client sends only product, quantity, note and address) |
| Money | Whole-number IDR, `Decimal` for USD and rates; USD prices computed with decimal arithmetic, never floats |
| Uploads | Browser uploads straight to R2 with presigned URLs. **Content type and the exact byte count are part of the signature**, so a URL issued for a 180 KB JPEG cannot carry a 2 GB MP4 — the storage refuses it, not the app. The key is server-generated (`randomUUID` under `products/<userId>/` or `private/<userId>/`), so a client can neither choose a path nor overwrite another person's file. Limits: photo ≤ 500 KB (the browser resizes to 2000 px and re-encodes first), video ≤ 100 MB. Presigning is **rate-limited per user** (40/min, 400/day; downloads 60/min, 2000/day) — the API never sees the bytes, so that limit is the only thing bounding how many objects one account can create. The browser also checks magic bytes, so a renamed `.exe` or `.html` never reaches the bucket. Private files are readable only by the uploader or an admin, through 5-minute signed URLs |
| Config | Env validated at startup (`JWT_SECRET` ≥ 32 chars, R2 settings all-or-nothing and mandatory in production); `.env` files are git-ignored |
| Secrets in git | Checked on 2026-10-30: no real secret value (JWT, R2 keys) in the working tree or in any of the 12 commits. Only placeholders live in `.env.example` |
| Dependencies | `pnpm audit` was clean on 2026-10-30 (after upgrading `@nestjs/platform-express` and `body-parser`); on 2026-10-31 it reports 1 moderate advisory for `minimatch` inside the lint toolchain (`eslint-config-next`, dev-only, not shipped or run on the server), accepted until that package updates; versions pinned exactly; `minimumReleaseAge` delays brand-new releases; install scripts are deny-by-default (`allowBuilds` in `pnpm-workspace.yaml`) |

## Open items

Ordered by importance. **Items 1 to 3 must be done before anything runs on a shared server (VPS) or handles real data.**

1. **Replace the development passwords.** The admin password (`ADMIN_PASSWORD`), the Postgres password and `DATABASE_URL` in the local `.env` files are still the public placeholders from `.env.example`. Use strong, unique values on every other environment. `pnpm db:seed` does **not** overwrite an existing admin, and there is no change-password feature yet, so on a fresh database set `ADMIN_PASSWORD` before the first `db:seed`; for an existing admin, change the hash with a one-off script.
2. **Presigned URLs cannot be made single-use** — neither S3 nor R2 offers it, and anyone claiming otherwise is wrong. It matters
   less than it sounds: re-using one inside its 5-minute window overwrites **the same key** with **the same content type** and the
   **same exact byte count**, so it cannot create a second object or grow storage. What is worth making single-use is the *key* at
   application level (an `UploadTicket` row, consumed when the key is attached to a product or a payment), which would also give a
   list of orphaned files to sweep. Decided 2026-11-12 to defer both that and a per-seller storage quota; the rate limit above is
   what actually bounds the bill today, and **nothing deletes an uploaded file that is never attached to anything**.
3. **Two buckets is a requirement, not a preference.** Public access in R2 is a **bucket-level** setting, so a `private/` folder inside a public
   bucket is not private: on 2026-11-12 two test payment proofs left in `eksportir-testing/private/` were fetched over plain HTTPS with HTTP 200, and
   were deleted. One bucket forces a choice between leaking proofs and serving product photos through 5-minute signed URLs that `<img>` cannot cache.
4. **Split the R2 buckets — and their credentials.** The private bucket must never have public access (no `r2.dev` URL, no custom domain). Since 2026-11-12 each bucket also gets **its own API token**: `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` scoped to the public bucket, `R2_PRIVATE_ACCESS_KEY_ID`/`R2_PRIVATE_SECRET_ACCESS_KEY` scoped to the private one. The public key signs every product photo upload, so it is the one most exposed; without the split it could also read payment proofs. The private pair is optional and falls back to the public one, which keeps a half-configured development box working — the API logs a warning at startup whenever the buckets differ and the keys do not. Do this before payment proofs and QC files exist (T17+).
5. **Protect admin accounts.** Admins approve sellers, listings and payments. There is no 2FA, no email verification and no password reset yet (T21). Add at least a strong-password policy and, ideally, 2FA for admin roles before real money moves.
6. **HTTPS everywhere in production.** The `secure` cookie flag and HSTS only help behind HTTPS (Caddy, T23). Web and API must share one site (subdomains of the same domain), otherwise the cookie is not sent.
7. **No Content-Security-Policy on the web app** (needs nonces for Next's inline scripts). Add after the UI stabilises.
8. **Logout does not revoke the JWT** (stateless). Acceptable for the MVP; shorten `JWT_EXPIRES_IN_SECONDS` if that worries you.
9. **Rate limiting is per process, and in memory.** Login, chat messages and the upload limits all count inside one API instance; a second instance doubles every limit, and a restart resets them. Move the throttler storage to Redis before running more than one instance.
10. **Public media URL.** `r2.dev` URLs are rate-limited by Cloudflare and meant for development; use a custom domain for the public bucket in production.
11. **Consent for admin in chats.** Done in T13b: sign-up requires `acceptAdminInChat: true` (enforced by the API) and stores when and which wording was accepted. Accounts created before that, and admin accounts from the seed, have no consent record; the chat does not check it yet.
12. **Chat limits and attachments.** (Notifications are private to their owner: every route filters by the logged-in user, other users' ids answer 404, and pushes only go to the owner's own socket room.) Messages are limited to 20 per user per minute (in memory, one API instance like the login throttle) and 2000 characters. Sockets cannot write, and refuse a foreign `Origin`. Open: a user whose role is removed keeps the rooms they already joined until their socket reconnects; attachments (T13) must be validated like other private uploads.
13. **Backups** are not set up yet (T24): daily `pg_dump` to R2, encrypted, with one tested restore.
14. **Changing the phone number must get harder the moment it can receive codes.** Since T28 a person can set their own phone on
    `PATCH /api/auth/me` with nothing but their session — fine today, because the number is only a way for the team to reach them
    and is never shown to buyers (it is not part of `PublicSellerProfile`). As soon as it can receive a one-time code or a password
    reset (T21 and anything after it), that same ease becomes the cheapest account takeover there is: change the number, receive
    the code, keep the account. Before that ships, a change must require the current password **and** a check of the new number,
    and the old number should be told. Deliberately not built in advance: there is nothing to verify against yet.

## Routine checks

```bash
pnpm audit                         # known vulnerabilities in dependencies (run before each release)
git ls-files | grep -iE '(^|/)\.env($|\.)'   # only .env.example files may be tracked
```

Before pushing, look at `git status` and stage files explicitly (no `git add .`).

## If a secret leaks

Treat it as compromised, even if the commit is deleted (history, forks and caches keep it).

| Secret | Do this |
|---|---|
| R2 access key / secret | Cloudflare → R2 → API tokens → delete the token, create a new one, update `apps/api/.env` |
| `JWT_SECRET` | Generate a new random value (≥ 32 chars) and restart the API; every user is logged out |
| Database password | Change it in Postgres and in `DATABASE_URL`, restart the API |
| Admin password | Change the hash in the database and review recent admin actions |

Then find out how it leaked (a pasted log, a screenshot, a committed file) so it does not repeat.
