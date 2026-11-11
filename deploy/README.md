# Copies of what runs on the VPS

These are not deployed from here — they are copies of the files that live on the VPS, kept in the repo so
the layout is reviewable and recoverable. If you change one on the server, update the copy here too.

| File here | Lives on the VPS at |
|---|---|
| `infra-docker-compose.yml` | `/home/ubuntu/infra/docker-compose.yml` (shared nginx, owns ports 80/443) |
| `nginx-balitrade.conf` | `/home/ubuntu/infra/conf.d/balitrade.conf` |
| `../docker-compose.prod.yml` | `/home/ubuntu/balitrade/docker-compose.yml` |
| `../.env.prod.example` | the shape of `/home/ubuntu/balitrade/.env` (the real one is never committed) |

The full picture, including the PostgreSQL and firewall settings that let containers reach the host
database, is in `docs/ARCHITECTURE.md` §8.
