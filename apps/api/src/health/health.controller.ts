import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import { HealthService, type ReadinessReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  getLiveness(): { readonly status: 'UP'; readonly service: 'fulishe-api' } {
    return { status: 'UP', service: 'fulishe-api' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessReport> {
    const report = await this.healthService.getReadiness();
    response.status(report.status === 'UP' ? 200 : 503);
    return report;
  }
}
