import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../config/runtime-config.js';
import { createBoundedRetryStrategy } from './foundation-policy.js';
import type { InfrastructureProbe, ProbeCheck } from './probe.js';

@Injectable()
export class RedisService implements InfrastructureProbe, OnApplicationShutdown {
  readonly name = 'redis' as const;
  private client: Redis | undefined;

  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  private createClient(): Redis {
    const retryStrategy = createBoundedRetryStrategy(this.config);
    const client = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: this.config.connectTimeoutMs,
      maxRetriesPerRequest: 1,
      retryStrategy,
    });
    client.on('error', () => undefined);
    return client;
  }

  private async getClient(): Promise<Redis> {
    if (!this.client || this.client.status === 'end') {
      this.client?.disconnect();
      this.client = this.createClient();
    }
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    return this.client;
  }

  async check(): Promise<ProbeCheck> {
    const startedAt = performance.now();
    try {
      const client = await this.getClient();
      const response = await client.ping();
      return {
        status: response === 'PONG' ? 'UP' : 'DOWN',
        code: response === 'PONG' ? 'OK' : 'REDIS_UNEXPECTED_RESPONSE',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    } catch {
      return {
        status: 'DOWN',
        code: 'REDIS_UNAVAILABLE',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    }
  }

  onApplicationShutdown(): void {
    this.client?.disconnect();
    this.client = undefined;
  }
}
