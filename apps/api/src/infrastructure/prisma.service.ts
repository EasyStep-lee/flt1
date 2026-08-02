import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@fulishe/db';

import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../config/runtime-config.js';
import type { InfrastructureProbe, ProbeCheck } from './probe.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements InfrastructureProbe, OnApplicationShutdown
{
  readonly name = 'database' as const;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    super({ datasources: { db: { url: config.databaseUrl } } });
  }

  async check(): Promise<ProbeCheck> {
    const startedAt = performance.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'UP',
        code: 'OK',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    } catch {
      return {
        status: 'DOWN',
        code: 'DATABASE_UNAVAILABLE',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }
}
