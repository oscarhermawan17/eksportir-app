import { Controller, Get } from '@nestjs/common';
import type { CurrentRateView } from '@balitrade/shared';
import { FxService } from './fx.service.js';

/** Public (no login): the rate that USD prices are calculated with. */
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('current')
  current(): Promise<CurrentRateView> {
    return this.fx.current();
  }
}
