import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { QcService } from './qc.service.js';

/** How often the API looks for overdue reports. The 48-hour deadline is therefore met within about ten minutes. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Approves QC reports the buyer has not answered within QC_LIMITS.autoApproveHours (T18), like other marketplaces
 * do, so an order never waits forever on a buyer who went quiet. A plain timer instead of a scheduler package: the
 * API runs as one instance, and the conditional updates in QcService make a run that overlaps a buyer's own click
 * harmless. Off under NODE_ENV=test, where e2e tests call `QcService.approveOverdue` themselves with a chosen time.
 */
@Injectable()
export class QcAutoApproveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QcAutoApproveService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly qc: QcService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Never keep the process alive just for this timer.
    this.timer.unref();
    // Catch up straight away after a restart or deploy instead of waiting a full interval.
    setTimeout(() => void this.sweep(), 30_000).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const approved = await this.qc.approveOverdue();
      if (approved > 0) this.logger.log(`Approved ${approved} QC report(s) the buyer left unanswered`);
    } catch (error) {
      this.logger.error('The QC auto-approval sweep failed', error);
    } finally {
      this.running = false;
    }
  }
}
