import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from '../config/runtime-config.js';
import {
  DEFAULT_FOUNDATION_POLICY,
  createBoundedRetryStrategy,
} from './foundation-policy.js';
import type { InfrastructureProbe, ProbeCheck } from './probe.js';

@Injectable()
export class QueueService implements InfrastructureProbe, OnApplicationShutdown {
  readonly name = 'queue' as const;
  private connection: Redis | undefined;
  private queue: Queue | undefined;

  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  private createConnection(): Redis {
    const connection = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: this.config.connectTimeoutMs,
      maxRetriesPerRequest: 1,
      retryStrategy: createBoundedRetryStrategy(this.config),
    });
    connection.on('error', () => undefined);
    return connection;
  }

  private getQueue(): Queue {
    if (!this.queue || !this.connection || this.connection.status === 'end') {
      if (this.queue) {
        void this.queue.close().catch(() => undefined);
      }
      this.connection?.disconnect();
      this.connection = this.createConnection();
      this.queue = new Queue('foundation-health', {
        connection: this.connection,
        prefix: this.config.queuePrefix,
        defaultJobOptions: DEFAULT_FOUNDATION_POLICY.queue,
      });
      this.queue.on('error', () => undefined);
    }
    return this.queue;
  }

  async check(): Promise<ProbeCheck> {
    const startedAt = performance.now();
    try {
      const queue = this.getQueue();
      await queue.getJobCounts('wait', 'active', 'delayed', 'failed');
      return {
        status: 'UP',
        code: 'OK',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    } catch {
      return {
        status: 'DOWN',
        code: 'QUEUE_UNAVAILABLE',
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close().catch(() => undefined);
    }
    this.connection?.disconnect();
    this.queue = undefined;
    this.connection = undefined;
  }
}
