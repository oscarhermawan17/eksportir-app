#!/usr/bin/env node
/**
 * Says which database each side is pointing at and whether it answers — the first thing to run when
 * the app throws connection errors. Reads apps/api/.env; prints hosts and ports, never passwords.
 */
import { createConnection } from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
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

/** Does something listen there? A plain TCP probe: no credentials, no query. */
function probe(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: Number(port) });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Host and port only — the connection string carries the password. */
function describe(url) {
  if (!url) return null;
  try {
    const { hostname, port, pathname } = new URL(url);
    return { host: hostname, port: port || '5432', database: pathname.replace(/^\//, '') };
  } catch {
    return { host: '?', port: '?', database: '(unparseable connection string)' };
  }
}

const env = readEnvFile(join(ROOT, 'apps/api/.env'));
if (env === null) {
  console.error(
    '\n✖ apps/api/.env not found. Copy apps/api/.env.example to apps/api/.env first.\n',
  );
  process.exit(1);
}

const rows = [
  { label: 'DATABASE_URL       (app, api dev, studio)', target: describe(env.DATABASE_URL) },
  { label: 'LOCAL_DATABASE_URL (migrate, seed, e2e)  ', target: describe(env.LOCAL_DATABASE_URL) },
];

console.log('');
let problems = 0;
for (const { label, target } of rows) {
  if (!target) {
    console.log(`${label}  — not set`);
    continue;
  }
  const reachable = await probe(target.host, target.port);
  if (!reachable) problems += 1;
  const mark = reachable ? '✔' : '✖';
  console.log(`${label}  ${mark} ${target.host}:${target.port}/${target.database}`);
}

const appTarget = describe(env.DATABASE_URL);
if (appTarget && appTarget.port === '5433') {
  console.log('\nDATABASE_URL uses port 5433, so it is the VPS through the SSH tunnel.');
  console.log('Open it with `pnpm db:tunnel` and leave that terminal running.');
}
if (problems > 0) {
  console.log(
    '\nSomething marked ✖ is not answering: start `pnpm db:tunnel` (VPS) or `pnpm db:up` (Docker).',
  );
}
console.log('');
process.exit(problems > 0 ? 1 : 0);
