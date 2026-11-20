#!/usr/bin/env node
// pnpm db:pull — replaces the LOCAL development database with a copy of the testing server's database.
//
// Reads the server, writes only the local Docker container:
//   1. `pg_dump` runs on the server over SSH (the server's own pg_dump matches its PostgreSQL version) and the dump is
//      saved to a temporary file. Nothing is written on the server.
//   2. The dump is checked with `pg_restore --list` BEFORE the local database is touched, so a failed download never
//      leaves you with an empty database.
//   3. The local database is dropped, recreated and restored in one transaction.
//   4. The temporary file is deleted (it holds the testers' personal data), and local migrations that the server does
//      not have yet are applied on top.
//
// The SSH host defaults to the `balitrade` alias from ~/.ssh/config; set BALITRADE_SSH_HOST to use another one
// (e.g. `ubuntu@43.133.155.17`). Pass --yes to skip the confirmation.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { assertContainerRunning, CONTAINER, db, fail, localUrl, recreateDatabase, runApi, step } from './lib/local-db.mjs';

const SSH_HOST = process.env.BALITRADE_SSH_HOST || 'balitrade';
const REMOTE_DB = 'balitrade';
const LOCAL_DB = 'balitrade';

async function confirm() {
  if (process.argv.includes('--yes')) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This REPLACES the local database "${LOCAL_DB}" (Docker, port ${db.port}) with a copy from ${SSH_HOST}. Continue? [y/N] `,
  );
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) fail('Cancelled. Nothing was changed.');
}

/** Streams `pg_dump` from the server into a local file. Binary-safe: stdout goes straight to the file descriptor. */
function dumpFromServer(file) {
  return new Promise((resolve) => {
    const fd = openSync(file, 'w');
    const child = spawn(
      'ssh',
      ['-o', 'BatchMode=yes', SSH_HOST, `sudo -n -u postgres pg_dump --format=custom --no-owner --no-acl ${REMOTE_DB}`],
      { stdio: ['ignore', fd, 'inherit'] },
    );
    child.on('error', () => {
      closeSync(fd);
      fail('Could not start ssh.');
    });
    child.on('close', (code) => {
      closeSync(fd);
      if (code !== 0) fail(`pg_dump on ${SSH_HOST} failed (exit ${code}). The local database was not touched.`);
      resolve();
    });
  });
}

/** Feeds a local file to a command inside the container on stdin. */
function execWithFile(args, file, capture = false) {
  const fd = openSync(file, 'r');
  try {
    return spawnSync('docker', ['exec', '-i', CONTAINER, ...args], {
      stdio: [fd, capture ? 'pipe' : 'inherit', 'inherit'],
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    closeSync(fd);
  }
}

async function main() {
  assertContainerRunning();
  await confirm();

  const file = join(tmpdir(), `balitrade-pull-${process.pid}-${Date.now()}.dump`);
  try {
    step(`Dumping "${REMOTE_DB}" on ${SSH_HOST} (read only)…`);
    await dumpFromServer(file);
    const size = statSync(file).size;
    if (size === 0) fail('The dump is empty. The local database was not touched.');
    console.log(`  ${(size / 1024).toFixed(0)} KB downloaded`);

    step('Checking the dump…');
    const list = execWithFile(['pg_restore', '--list'], file, true);
    if (list.status !== 0 || !/TABLE public orders /.test(list.stdout ?? '')) {
      fail('The dump is not a readable BaliTrade database. The local database was not touched.');
    }

    step(`Replacing the local database "${LOCAL_DB}"…`);
    recreateDatabase(LOCAL_DB);
    const restore = execWithFile(
      ['pg_restore', '-U', db.user, '-d', LOCAL_DB, '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl'],
      file,
    );
    if (restore.status !== 0) fail('pg_restore failed. Run pnpm db:pull again.');
  } finally {
    rmSync(file, { force: true });
  }

  step('Applying local migrations the server does not have yet…');
  await runApi(['prisma', 'migrate', 'deploy'], localUrl(LOCAL_DB));

  console.log(`\n✔ The local database is now a copy of the testing server.`);
  console.log('  Log in with the accounts and passwords of projectbali.my.id.');
}

await main();
