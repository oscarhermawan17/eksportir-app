import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@balitrade/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/health — used by deploy checks and the web app. */
  @Get()
  async check(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down', timestamp });
    }
  }
}
