import { Inject, Injectable } from '@nestjs/common';

import {
  FOUNDATION_PROBES,
  HEALTH_PROBE_TIMEOUT_MS,
  type FoundationDependencyName,
  type InfrastructureProbe,
  type ProbeCheck,
} from '../infrastructure/probe.js';

export interface ReadinessReport {
  readonly status: 'UP' | 'DOWN';
  readonly service: 'fulishe-api';
  readonly checkedAt: string;
  readonly checks: Readonly<
    Partial<Record<FoundationDependencyName, ProbeCheck>>
  >;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(FOUNDATION_PROBES)
    private readonly probes: readonly InfrastructureProbe[],
    @Inject(HEALTH_PROBE_TIMEOUT_MS)
    private readonly probeTimeoutMs: number,
  ) {}

  async getReadiness(): Promise<ReadinessReport> {
    const results = await Promise.all(
      this.probes.map(async (probe) => [probe.name, await this.runProbe(probe)] as const),
    );
    const checks: Partial<Record<FoundationDependencyName, ProbeCheck>> = {};
    for (const [name, result] of results) {
      checks[name] = result;
    }

    return {
      status: results.every(([, result]) => result.status === 'UP')
        ? 'UP'
        : 'DOWN',
      service: 'fulishe-api',
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private async runProbe(probe: InfrastructureProbe): Promise<ProbeCheck> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        probe.check(),
        new Promise<ProbeCheck>((resolve) => {
          timeout = setTimeout(
            () =>
              resolve({
                status: 'DOWN',
                code: 'PROBE_TIMEOUT',
                latencyMs: this.probeTimeoutMs,
              }),
            this.probeTimeoutMs,
          );
        }),
      ]);
    } catch {
      return {
        status: 'DOWN',
        code: 'PROBE_FAILED',
        latencyMs: 0,
      };
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
