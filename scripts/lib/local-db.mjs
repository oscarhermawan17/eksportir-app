// Shared helpers for the local database scripts (db-pull.mjs, db-test-prepare.mjs).
// Everything here talks to the Docker container from docker-compose.yml and nothing else: the scripts never read
// DATABASE_URL from apps/api/.env, so a .env that still points at the testing server cannot redirect them there.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTAINER = 'balitrade-postgres';

/** POSTGRES_* from the root .env when it exists, else the docker-compose.yml defaults. */
function composeSettings() {
  const values = {};
  const file = join(ROOT, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(POSTGRES_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return {
    user: values.POSTGRES_USER || 'balitrade',
    password: values.POSTGRES_PASSWORD || 'balitrade',
    port: values.POSTGRES_PORT || '5432',
  };
}

export const db = composeSettings();

/** Connection string for a database inside the local container, as seen from this machine. */
export function localUrl(database) {
  return `postgresql://${encodeURIComponent(db.user)}:${encodeURIComponent(db.password)}@localhost:${db.port}/${database}`;
}

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

export function step(message) {
  console.log(`\n→ ${message}`);
}

/** Stops early with a useful message when Docker or the container is not running. */
export function assertContainerRunning() {
  const result = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER], { encoding: 'utf8' });
  if (result.error) fail('Docker is not available. Start Docker Desktop first.');
  if (result.status !== 0 || result.stdout.trim() !== 'true') {
    fail(`The container ${CONTAINER} is not running. Start it with: pnpm db:up`);
  }
}

/** Runs SQL against the maintenance database inside the container (for DROP/CREATE DATABASE). */
export function adminSql(sql) {
  const result = spawnSync('docker', ['exec', CONTAINER, 'psql', '-U', db.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'inherit',
  });
  if (result.status !== 0) fail(`SQL failed: ${sql}`);
}

/** Drops and recreates a database inside the local container. Only ever called with a fixed, known name. */
export function recreateDatabase(name) {
  if (!/^[a-z_]+$/.test(name)) fail(`Refusing an unexpected database name: ${name}`);
  adminSql(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  adminSql(`CREATE DATABASE ${name} OWNER ${db.user}`);
}

/**
 * Runs a command of the API package (prisma) with DATABASE_URL forced to the given local database. The variable is
 * set in the process environment, which dotenv never overrides, so apps/api/.env cannot point it elsewhere.
 */
export function runApi(args, databaseUrl) {
  return new Promise((resolve) => {
    // `pnpm` is a .cmd shim on Windows, which Node only starts through a shell. The arguments are fixed strings.
    const child = spawn('pnpm', ['--filter', '@balitrade/api', 'exec', ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    child.on('close', (code) => (code === 0 ? resolve() : fail(`Command failed: ${args.join(' ')}`)));
  });
}
