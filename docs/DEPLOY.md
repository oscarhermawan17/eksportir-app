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

**Home ISPs in Indonesia block outbound port 5432**, so the owner's laptop cannot reach a remote PostgreSQL
directly. This never blocks real work:

- develop against the local Docker PostgreSQL (`pnpm db:up`),
- run production migrations **from the VPS**, or through a tunnel (below),
- read production data over `ssh` + `psql`.

```bash
# only if you really need the VPS database from the laptop; 5433 avoids clashing with the local one
ssh -N -L 5433:localhost:5432 ubuntu@43.133.155.17
```

While that tunnel is open, point `DATABASE_URL` in `apps/api/.env` at `localhost:5433` — **and put it back
afterwards**, or every local command and test fails with a confusing connection error.

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
