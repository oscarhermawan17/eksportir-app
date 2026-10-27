import { Injectable } from '@nestjs/common';
import type { CurrentRateView, ExchangeRateView } from '@balitrade/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RATE_DECIMALS = 4;
const HISTORY_LIMIT = 50;

type RateRow = Prisma.ExchangeRateGetPayload<{ include: { setBy: { select: { id: true; name: true } } } }>;

/**
 * Manual exchange rate (IDR per 1 USD). Every change is a new row, so the table is also the history
 * of who set which rate and when; the newest row is the rate in force.
 */
@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  /** The rate in force, or null while the owner has not set one yet. */
  async latest(): Promise<{ rate: Prisma.Decimal; createdAt: Date } | null> {
    return this.prisma.exchangeRate.findFirst({
      select: { rate: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async current(): Promise<CurrentRateView> {
    const latest = await this.latest();
    return latest
      ? { rate: latest.rate.toFixed(RATE_DECIMALS), updatedAt: latest.createdAt.toISOString() }
      : { rate: null, updatedAt: null };
  }

  async history(): Promise<ExchangeRateView[]> {
    const rows = await this.prisma.exchangeRate.findMany({
      include: { setBy: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_LIMIT,
    });
    return rows.map(toView);
  }

  async set(rate: number, adminId: string): Promise<ExchangeRateView> {
    const row = await this.prisma.exchangeRate.create({
      data: { rate: new Prisma.Decimal(rate), setById: adminId },
      include: { setBy: { select: { id: true, name: true } } },
    });
    return toView(row);
  }
}

function toView(row: RateRow): ExchangeRateView {
  return {
    id: row.id,
    rate: row.rate.toFixed(RATE_DECIMALS),
    setBy: row.setBy,
    createdAt: row.createdAt.toISOString(),
  };
}
