#!/usr/bin/env node
/**
 * Runs a destructive database command against the LOCAL Docker PostgreSQL — never the VPS.
 *
 * Since 2026-11-12 `apps/api/.env` points `DATABASE_URL` at the VPS database through the SSH tunnel,
 * so a fresh clone reads real testing data with no setup. Three commands must NOT follow it:
 *
 *   - `prisma migrate dev` may decide the database has drifted and offer to RESET it (wipe every order);
 *   - the seed rewrites the admin account;
 *   - the e2e suite creates and deletes users, in parallel.
 *
 * They run against `LOCAL_DATABASE_URL` instead, and reach the VPS only through `pnpm db:deploy`
 * (`prisma migrate deploy`), which applies migrations and never drops data.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, 'apps/api/.env');
/** The port docker-compose.yml publishes. 5433 is the tunnel to the VPS, so it is deliberately not local. */
const DOCKER_PORT = '5432';
const FALLBACK_URL = 'postgresql://balitrade:balitrade@localhost:5432/balitrade';

/** Minimal .env reader: KEY=value, optional quotes, `#` comments. No dependency on dotenv. */
function readEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function fail(lines) {
  console.error(`\n✖ ${lines.join('\n  ')}\n`);
  process.exit(1);
}

const command = process.argv.slice(2);
if (command.length === 0) fail(['Usage: node scripts/db-local.mjs <command> [args...]']);

const fileEnv = readEnvFile(ENV_FILE);
// `process.env.DATABASE_URL` is third on purpose: nothing loads apps/api/.env into the shell, so it is
// only set when something outside chose it — CI, where the Postgres service IS the local database.
const url =
  process.env.LOCAL_DATABASE_URL ??
  fileEnv.LOCAL_DATABASE_URL ??
  process.env.DATABASE_URL ??
  FALLBACK_URL;

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail([`LOCAL_DATABASE_URL is not a valid URL.`, `Expected something like ${FALLBACK_URL}`]);
}

const host = parsed.hostname;
const port = parsed.port || DOCKER_PORT;
const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';

if (!isLoopback || port !== DOCKER_PORT) {
  fail([
    `Refusing to run \`${command.join(' ')}\` against ${host}:${port}.`,
    ``,
    `This command can destroy data, so it only runs against the local Docker PostgreSQL`,
    `(a loopback host on port ${DOCKER_PORT}). Port 5433 is the SSH tunnel to the VPS, and the VPS`,
    `database holds the only copy of the testing orders and payment proofs.`,
    ``,
    `Start the local database with \`pnpm db:up\` and set LOCAL_DATABASE_URL in apps/api/.env to`,
    `${FALLBACK_URL}`,
    ``,
    `To apply migrations to the VPS, use \`pnpm db:deploy\` (migrate deploy never drops data).`,
  ]);
}

console.log(`→ ${command.join(' ')}  [local database ${host}:${port}]`);
const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
if (result.error) fail([`Could not run \`${command[0]}\`: ${result.error.message}`]);
process.exit(result.status ?? 1);
