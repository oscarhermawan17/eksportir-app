import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/password.js';

/**
 * QC zones = the 9 regencies/cities of Bali. The fees are PLACEHOLDERS: the real tariff per zone
 * is still an open business decision (docs/BRAINSTORMING.md, "Tarif QC per zona"). Existing zones are
 * never overwritten by the seed, so fees edited later in the database are kept.
 */
const QC_ZONES: { name: string; feeUsd: string }[] = [
  { name: 'Badung', feeUsd: '3.00' },
  { name: 'Denpasar', feeUsd: '3.00' },
  { name: 'Gianyar', feeUsd: '5.00' },
  { name: 'Tabanan', feeUsd: '5.00' },
  { name: 'Klungkung', feeUsd: '6.00' },
  { name: 'Bangli', feeUsd: '6.00' },
  { name: 'Karangasem', feeUsd: '8.00' },
  { name: 'Buleleng', feeUsd: '8.00' },
  { name: 'Jembrana', feeUsd: '8.00' },
];

/**
 * Seeds the first admin account from env (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME) and the QC zones.
 * Safe to run multiple times: existing rows are not overwritten.
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

    for (const zone of QC_ZONES) {
      await prisma.qcZone.upsert({ where: { name: zone.name }, update: {}, create: zone });
    }
    console.log(`QC zones ready: ${QC_ZONES.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
