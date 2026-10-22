import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';

/**
 * Seeds the first admin account from env (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME).
 * Safe to run multiple times: existing users are not overwritten.
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'BaliTrade Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in apps/api/.env');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name,
        passwordHash: await hashPassword(password),
        roles: [Role.ADMIN_OWNER, Role.ADMIN_FINANCE, Role.ADMIN_OPS],
      },
    });
    console.log(`Admin ready: ${admin.email} (${admin.roles.join(', ')})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
