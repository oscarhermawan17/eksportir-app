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
| Money | Whole-number IDR, `Decimal` for USD and rates; USD prices computed with decimal arithmetic, never floats |
| Uploads | Browser uploads straight to R2 with presigned URLs; type and exact size are part of the signature (photo ≤ 10 MB, video ≤ 50 MB); private files readable only by the uploader or an admin, through 5-minute signed URLs |
| Config | Env validated at startup (`JWT_SECRET` ≥ 32 chars, R2 settings all-or-nothing and mandatory in production); `.env` files are git-ignored |
| Secrets in git | Checked on 2026-10-30: no real secret value (JWT, R2 keys) in the working tree or in any of the 12 commits. Only placeholders live in `.env.example` |
| Dependencies | `pnpm audit` was clean on 2026-10-30 (after upgrading `@nestjs/platform-express` and `body-parser`); on 2026-10-31 it reports 1 moderate advisory for `minimatch` inside the lint toolchain (`eslint-config-next`, dev-only, not shipped or run on the server), accepted until that package updates; versions pinned exactly; `minimumReleaseAge` delays brand-new releases; install scripts are deny-by-default (`allowBuilds` in `pnpm-workspace.yaml`) |

## Open items

Ordered by importance. **Items 1 to 3 must be done before anything runs on a shared server (VPS) or handles real data.**

1. **Replace the development passwords.** The admin password (`ADMIN_PASSWORD`), the Postgres password and `DATABASE_URL` in the local `.env` files are still the public placeholders from `.env.example`. Use strong, unique values on every other environment. `pnpm db:seed` does **not** overwrite an existing admin, and there is no change-password feature yet, so on a fresh database set `ADMIN_PASSWORD` before the first `db:seed`; for an existing admin, change the hash with a one-off script.
2. **Split the R2 buckets.** Development uses one bucket for public and private files. The private bucket must never have public access (no `r2.dev` URL, no custom domain). Do this before payment proofs and QC files exist (T17+).
3. **Protect admin accounts.** Admins approve sellers, listings and payments. There is no 2FA, no email verification and no password reset yet (T21). Add at least a strong-password policy and, ideally, 2FA for admin roles before real money moves.
4. **HTTPS everywhere in production.** The `secure` cookie flag and HSTS only help behind HTTPS (Caddy, T23). Web and API must share one site (subdomains of the same domain), otherwise the cookie is not sent.
5. **No Content-Security-Policy on the web app** (needs nonces for Next's inline scripts). Add after the UI stabilises.
6. **Logout does not revoke the JWT** (stateless). Acceptable for the MVP; shorten `JWT_EXPIRES_IN_SECONDS` if that worries you.
7. **Login throttling is per process.** Move it to Redis if the API ever runs more than one instance.
8. **Public media URL.** `r2.dev` URLs are rate-limited by Cloudflare and meant for development; use a custom domain for the public bucket in production.
9. **Consent for admin in chats.** The sign-up checkbox is required in the form but not stored in the database yet (privacy law requires transparency; see `docs/BRAINSTORMING.md` section 7).
10. **Chat limits and attachments.** (Notifications are private to their owner: every route filters by the logged-in user, other users' ids answer 404, and pushes only go to the owner's own socket room.) Messages are limited to 20 per user per minute (in memory, one API instance like the login throttle) and 2000 characters. Sockets cannot write, and refuse a foreign `Origin`. Open: a user whose role is removed keeps the rooms they already joined until their socket reconnects; attachments (T13) must be validated like other private uploads.
11. **Backups** are not set up yet (T24): daily `pg_dump` to R2, encrypted, with one tested restore.

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
