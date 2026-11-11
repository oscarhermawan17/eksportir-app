# Deploy and operations

The testing environment, how to reach it, and how to change it. **This is a testing environment, not
production** — `projectbali.my.id` is where things are tried out. Production does not exist yet.

The reasoning behind these choices (why one VPS, why nginx instead of Caddy, when to move the database to a
managed service) is in `docs/ARCHITECTURE.md` §8 and `docs/DECISIONS.md`. This file is the *how*.

---

## 1. Reaching the server

```bash
ssh ubuntu@43.133.155.17
```

Key-based, no password: the owner's `~/.ssh/id_ed25519` is in the server's `authorized_keys`. An assistant
working from the owner's machine can use the same key — it needs nothing else and no password anywhere.

| | |
|---|---|
| Host | `43.133.155.17`, Singapore, Ubuntu 24.04, 4 GB RAM, 2 vCPU, swap on |
| User | `ubuntu` (passwordless `sudo`) |
| Open to the internet | 22, 80, 443 only (ufw) |

### Working from the laptop against the VPS database (decided 2026-11-12)

**Home ISPs in Indonesia block outbound port 5432**, and the VPS firewall only opens 22, 80 and 443, so the
database is reached **over SSH** — nothing about PostgreSQL is exposed to the internet. Since 2026-11-12 that
tunnel is the owner's normal way of working: clone the repo anywhere, open the tunnel, run web + api, and the
app reads the real testing data without seeding anything.

```bash
pnpm db:tunnel   # leave this terminal running: localhost:5433 → VPS PostgreSQL, reconnects by itself
pnpm setup       # Prisma client + shared package, then reports which database each URL points at
pnpm dev
```

`apps/api/.env` holds **two** connection strings, and the split is the safety mechanism:

| Variable | Points at | Used by |
|---|---|---|
| `DATABASE_URL` | VPS through the tunnel, `localhost:5433` | the app, `pnpm dev`, `pnpm db:studio` |
| `LOCAL_DATABASE_URL` | local Docker, `localhost:5432` | `pnpm db:migrate`, `pnpm db:seed`, `test:e2e` |

`scripts/db-local.mjs` wraps those last three and **refuses to run against anything but a loopback host on
port 5432**. They each destroy data: `prisma migrate dev` can decide the database has drifted and offer to
reset it, the seed rewrites the admin account, and the e2e suite creates and deletes users in parallel. The
VPS database holds the only copy of the testing orders and payment proofs, so pointing any of them at it once
is enough to lose everything.

Schema changes therefore take the long way round, and that is deliberate:

```bash
pnpm db:migrate   # against local Docker (pnpm db:up first) — writes the migration file
# commit the migration, then with the tunnel open:
pnpm db:deploy    # prisma migrate deploy against the VPS: applies migrations, never drops data
```

`pnpm db:check` prints which database each URL points at and whether it answers — run it first whenever the
app throws connection errors. It prints hosts and ports only, never passwords.

The password for `DATABASE_URL` is the one in `/home/ubuntu/balitrade/.env` on the VPS. To copy it into the
laptop's `apps/api/.env` without putting it on screen:

```bash
ssh ubuntu@43.133.155.17 'grep -m1 ^DATABASE_URL= /home/ubuntu/balitrade/.env' | sed 's#@[^/]*/#@localhost:5433/#' >> apps/api/.env
```

Then delete the older `DATABASE_URL=` line above it, so only one remains.

To work fully offline (on a plane, or when the VPS is down), point `DATABASE_URL` at the Docker database too:
`pnpm db:up && pnpm db:migrate && pnpm db:seed`.

## 2. What runs where

```
/home/ubuntu/
├─ infra/          shared nginx — owns ports 80 and 443, one conf.d/ file per project
│  ├─ docker-compose.yml
│  └─ conf.d/{umkm,balitrade}.conf
├─ project/        the owner's other API (umkm-api, its database is on Supabase)
└─ balitrade/      this app: balitrade-web + balitrade-api
   ├─ docker-compose.yml
   └─ .env          ← never committed; chmod 600
```

All three join one Docker network, `edge`, created by hand once (`docker network create edge`). nginx reaches
the apps by container name; **the app containers publish no ports to the host at all**.

Keeping nginx in its own folder is deliberate: it used to live in `project/docker-compose.yml`, where a routine
`docker compose down` would have taken every site on the machine offline.

PostgreSQL 16 runs **natively on the host**, not in Docker, so no `compose down -v` can delete the data.
Copies of the server files are in `deploy/` in this repo.

| URL | Goes to |
|---|---|
| `https://projectbali.my.id` | `balitrade-web:3000` |
| `https://www.projectbali.my.id` | redirect to the apex |
| `https://api.projectbali.my.id` | `balitrade-api:4000` |
| `https://api.tokotimika.my.id` | `umkm-api:4000` (not ours — do not touch) |

## 3. Deploying a new version

CI builds, **you deploy**. Pushing to `main` runs the checks and pushes two images to GHCR; nothing reaches
the VPS on its own.

```bash
cd /home/ubuntu/balitrade
docker compose pull
docker compose up -d
```

To roll back, pin the previous image in `.env` and bring it up again:

```bash
IMAGE_TAG=sha-<full commit sha>
```

**After a migration is added**, apply it as well. The runtime image is lean and has no Prisma CLI, so run it
from the laptop through the tunnel from section 1:

```bash
pnpm --filter @balitrade/api db:deploy
```

Housekeeping, now and then: `docker image prune -a`.

## 4. Certificates

certbot on the host, **standalone** mode. One certificate covers `projectbali.my.id`, `www.` and `api.`;
`api.tokotimika.my.id` has its own. Renewal is automatic (`certbot.timer`).

Standalone needs port 80 free, so the renewal hooks stop and start nginx:

```
pre_hook  = docker stop nginx
post_hook = docker start nginx
```

**Every site on the box is down for ~30 seconds during a renewal.** Switching to `webroot` would remove that;
it has not been done so as not to disturb a working setup.

> **If you ever rename or replace the nginx container, edit those hooks** in
> `/etc/letsencrypt/renewal/*.conf`. A rename without updating them breaks renewal **silently** — nothing
> fails until the certificate expires months later. Verify with:

```bash
sudo certbot renew --dry-run
```

## 5. The database on the VPS

Native PostgreSQL 16, database `balitrade`, role `balitrade`. Three settings let containers reach it, and all
three are needed:

- `listen_addresses` includes the Docker bridge addresses (`172.17.0.1`, `172.18.0.1`, `172.19.0.1`) and
  **never** the public address;
- `pg_hba.conf` has `host balitrade balitrade 172.16.0.0/12 scram-sha-256`;
- ufw allows `5432` from `172.16.0.0/12` only.

> Without the ufw rule the connection **times out** instead of being refused — a symptom that reads like a
> dead database and can cost an afternoon.

Reading the data:

```bash
ssh ubuntu@43.133.155.17 "sudo -u postgres psql -d balitrade"
```

## 6. Secrets

`/home/ubuntu/balitrade/.env` (chmod 600) holds everything the API needs. Nothing there is in git;
`.env.prod.example` in the repo shows the shape.

The admin password lives in that file. Read it on the server, never over chat:

```bash
grep ADMIN_PASSWORD /home/ubuntu/balitrade/.env
```

> **The seed does not update an existing admin** (`upsert` with `update: {}`), so re-running it will not
> change a password. To change one, hash it with the project's scrypt format
> (`apps/api/src/common/password.ts`) and `UPDATE users SET password_hash = …`.

**Still open:** `R2_PRIVATE_BUCKET` names the same bucket as `R2_PUBLIC_BUCKET`, so payment proofs are
readable by anyone holding the URL. Create a second R2 bucket with public access off and point that variable
at it. One line, no code change.

## 7. GitHub

The repo is **public**: `oscarhermawan17/eksportir-app`. Workflow runs can be read without a token, which is
useful for checking a build:

```bash
curl -s "https://api.github.com/repos/oscarhermawan17/eksportir-app/actions/runs?per_page=1"
```

Per-step results come from the run's `jobs_url`. **Step logs need admin rights**, so reading them means
opening the job page in the browser and expanding the failed step.

One repository variable is required, under Settings → Secrets and variables → Actions → **Variables**
(not Secrets, and not *Environment* variables — the workflow declares no environment, so those are invisible
to it):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.projectbali.my.id/api` |

It is baked into the web bundle at build time, which is why a web image built for one environment cannot be
reused in another. The job fails on purpose when it is missing, rather than pushing a broken image.

## 8. Before anything real happens here

- [ ] Split off a private R2 bucket (section 6).
- [ ] Real payment details in `.env` and `PAY_MOCK=false` — until then the payment page warns that the
      account numbers are placeholders.
- [ ] `pg_dump` to R2 on a schedule, **with a restore actually tried once** (T24). While the database shares a
      box with the app, that backup is the only thing between a dead disk and losing every order record.
