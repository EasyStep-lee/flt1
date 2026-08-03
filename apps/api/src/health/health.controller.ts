import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { HealthLivenessDto, HealthReadinessDto } from './health.dto.js';
import { HealthService, type ReadinessReport } from './health.service.js';

@ApiExtraModels(ApiErrorResponseDto)
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'health.getLiveness', summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthLivenessDto })
  getLiveness(): HealthLivenessDto {
    return { status: 'UP', service: 'fulishe-api' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'health.getReadiness', summary: 'Readiness probe' })
  @ApiOkResponse({ type: HealthReadinessDto })
  @ApiServiceUnavailableResponse({ type: HealthReadinessDto })
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessReport> {
    const report = await this.healthService.getReadiness();
    response.status(report.status === 'UP' ? 200 : 503);
    return report;
  }
}
