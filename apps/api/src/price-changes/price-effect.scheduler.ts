import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../config/runtime-config.js';
import { DEFAULT_FOUNDATION_POLICY } from '../infrastructure/foundation-policy.js';
import {
  PRICE_CHANGE_REPOSITORY,
  type PriceChangeRepository,
  type PriceEffectJob,
} from './price-change.repository.js';

export const PRICE_EFFECT_SCHEDULER = Symbol('PRICE_EFFECT_SCHEDULER');

export interface PriceEffectScheduler {
  schedule(jobs: readonly PriceEffectJob[]): Promise<void>;
}

@Injectable()
export class BullPriceEffectScheduler
  implements PriceEffectScheduler, OnModuleInit, OnApplicationShutdown
{
  private readonly connection: Redis;
  private readonly workerConnection: Redis;
  private readonly queue: Queue;
  private readonly worker: Worker;
  private recoveryTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(RUNTIME_CONFIG) config: RuntimeConfig,
    @Inject(PRICE_CHANGE_REPOSITORY) private readonly repository: PriceChangeRepository,
  ) {
    const redisOptions = {
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    } as const;
    this.connection = new Redis(config.redisUrl, redisOptions);
    this.workerConnection = new Redis(config.redisUrl, redisOptions);
    this.connection.on('error', () => undefined);
    this.workerConnection.on('error', () => undefined);
    this.queue = new Queue('price-effects', {
      connection: this.connection,
      prefix: config.queuePrefix,
      defaultJobOptions: DEFAULT_FOUNDATION_POLICY.queue,
    });
    this.worker = new Worker(
      'price-effects',
      async (job) => this.repository.effect(String(job.data.outboxId)),
      { connection: this.workerConnection, prefix: config.queuePrefix },
    );
    this.queue.on('error', () => undefined);
    this.worker.on('error', () => undefined);
  }

  async onModuleInit(): Promise<void> {
    const recover = async (): Promise<void> => {
      try {
        await this.schedule(await this.repository.listPendingEffects());
      } catch {
        // Runtime health reports infrastructure failures. Persisted outboxes are
        // retried here without preventing the API from starting in degraded mode.
      }
    };
    await recover();
    this.recoveryTimer = setInterval(() => { void recover(); }, 30_000);
    this.recoveryTimer.unref();
  }

  async schedule(jobs: readonly PriceEffectJob[]): Promise<void> {
    const now = Date.now();
    await Promise.all(
      jobs.map((job) =>
        this.queue.add(
          'effect',
          { outboxId: job.id },
          {
            jobId: job.id,
            delay: Math.max(0, Date.parse(job.effectiveAt) - now),
          },
        ),
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    await this.worker.close().catch(() => undefined);
    await this.queue.close().catch(() => undefined);
    this.connection.disconnect();
    this.workerConnection.disconnect();
  }
}

export class InMemoryPriceEffectScheduler implements PriceEffectScheduler {
  private readonly jobs = new Map<string, PriceEffectJob>();

  constructor(private readonly repository: PriceChangeRepository) {}

  schedule(jobs: readonly PriceEffectJob[]): Promise<void> {
    for (const job of jobs) this.jobs.set(job.id, structuredClone(job));
    return Promise.resolve();
  }

  async flushDue(now = new Date()): Promise<void> {
    for (const job of [...this.jobs.values()]) {
      if (Date.parse(job.effectiveAt) <= now.getTime()) {
        await this.repository.effect(job.id, now);
        this.jobs.delete(job.id);
      }
    }
  }

  count(): number {
    return this.jobs.size;
  }
}

@Injectable()
export class NoopPriceEffectScheduler implements PriceEffectScheduler {
  schedule(): Promise<void> {
    return Promise.resolve();
  }
}
