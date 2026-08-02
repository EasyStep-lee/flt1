export const FOUNDATION_PROBES = Symbol('FOUNDATION_PROBES');
export const HEALTH_PROBE_TIMEOUT_MS = Symbol('HEALTH_PROBE_TIMEOUT_MS');

export type FoundationDependencyName = 'database' | 'redis' | 'queue';
export type ProbeStatus = 'UP' | 'DOWN';

export interface ProbeCheck {
  readonly status: ProbeStatus;
  readonly code: string;
  readonly latencyMs: number;
}

export interface InfrastructureProbe {
  readonly name: FoundationDependencyName;
  check(): Promise<ProbeCheck>;
}
