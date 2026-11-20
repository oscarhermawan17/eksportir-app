#!/usr/bin/env node
// pnpm db:test:prepare — (re)creates the e2e database "balitrade_test" in the local Docker container: empty, migrated
// and seeded, exactly like the database CI runs the e2e tests against. Run it once, and again whenever the tests
// leave it in a state you do not trust. The development copy of the server ("balitrade") is not touched.
import { assertContainerRunning, localUrl, recreateDatabase, runApi, step } from './lib/local-db.mjs';

const TEST_DB = 'balitrade_test';

assertContainerRunning();

step(`Recreating "${TEST_DB}"…`);
recreateDatabase(TEST_DB);

step('Migrating…');
await runApi(['prisma', 'migrate', 'deploy'], localUrl(TEST_DB));

step('Seeding…');
await runApi(['prisma', 'db', 'seed'], localUrl(TEST_DB));

// The URL is not printed: it carries the database password from the root .env.
console.log(`\n✔ "${TEST_DB}" is ready. E2E_DATABASE_URL in apps/api/.env must point at it (see apps/api/.env.example).`);
