import { Module, type DynamicModule, type Provider } from '@nestjs/common';

import { RUNTIME_CONFIG, type RuntimeConfig } from './config/runtime-config.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import {
  FOUNDATION_PROBES,
  HEALTH_PROBE_TIMEOUT_MS,
  type InfrastructureProbe,
} from './infrastructure/probe.js';
import { PrismaService } from './infrastructure/prisma.service.js';
import { QueueService } from './infrastructure/queue.service.js';
import { RedisService } from './infrastructure/redis.service.js';

export interface AppModuleOptions {
  readonly config: RuntimeConfig;
  readonly probes?: readonly InfrastructureProbe[];
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: RUNTIME_CONFIG, useValue: options.config },
      {
        provide: HEALTH_PROBE_TIMEOUT_MS,
        useValue: options.config.healthProbeTimeoutMs,
      },
      HealthService,
    ];

    if (options.probes) {
      providers.push({ provide: FOUNDATION_PROBES, useValue: options.probes });
    } else {
      providers.push(
        PrismaService,
        RedisService,
        QueueService,
        {
          provide: FOUNDATION_PROBES,
          inject: [PrismaService, RedisService, QueueService],
          useFactory: (
            database: PrismaService,
            redis: RedisService,
            queue: QueueService,
          ): readonly InfrastructureProbe[] => [database, redis, queue],
        },
      );
    }

    return {
      module: AppModule,
      controllers: [HealthController],
      providers,
    };
  }
}
