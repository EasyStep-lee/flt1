export interface RetryPolicy {
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
}

export interface FoundationPolicy extends RetryPolicy {
  readonly connectTimeoutMs: number;
  readonly healthProbeTimeoutMs: number;
  readonly queue: {
    readonly attempts: number;
    readonly backoff: {
      readonly type: 'exponential';
      readonly delay: number;
    };
    readonly removeOnComplete: number;
    readonly removeOnFail: number;
  };
}

export const DEFAULT_FOUNDATION_POLICY: FoundationPolicy = Object.freeze({
  connectTimeoutMs: 3_000,
  healthProbeTimeoutMs: 1_500,
  maxRetries: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 1_000,
  queue: Object.freeze({
    attempts: 3,
    backoff: Object.freeze({ type: 'exponential' as const, delay: 1_000 }),
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  }),
});

export const createBoundedRetryStrategy =
  (policy: RetryPolicy) =>
  (attempt: number): number | null => {
    if (attempt < 1 || attempt > policy.maxRetries) {
      return null;
    }

    return Math.min(
      policy.retryBaseDelayMs * 2 ** (attempt - 1),
      policy.retryMaxDelayMs,
    );
  };
