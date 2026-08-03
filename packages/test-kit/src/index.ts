export type ConcurrentAttempt<T> = () => Promise<T> | T;

export interface FulfilledAttempt<T> {
  readonly index: number;
  readonly status: 'fulfilled';
  readonly value: T;
}

export interface RejectedAttempt {
  readonly index: number;
  readonly reason: unknown;
  readonly status: 'rejected';
}

export type AttemptOutcome<T> = FulfilledAttempt<T> | RejectedAttempt;

export class TestInvariantError extends Error {
  constructor(
    readonly code: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = 'TestInvariantError';
  }
}

const createStartBarrier = (participants: number): (() => Promise<void>) => {
  let arrived = 0;
  let release: (() => void) | undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async (): Promise<void> => {
    arrived += 1;
    if (arrived > participants) {
      throw new TestInvariantError('CONCURRENCY_BARRIER_OVERFLOW', {
        arrived,
        participants,
      });
    }
    if (arrived === participants) {
      release?.();
    }
    await opened;
  };
};

/**
 * Releases every attempt only after all attempts are ready. The returned array
 * preserves input order so tests can report each competing actor deterministically.
 */
export const runConcurrently = async <T>(
  attempts: readonly ConcurrentAttempt<T>[],
): Promise<readonly AttemptOutcome<T>[]> => {
  if (attempts.length === 0) {
    throw new TestInvariantError('CONCURRENT_ATTEMPTS_REQUIRED');
  }

  const waitForStart = createStartBarrier(attempts.length);
  return await Promise.all(
    attempts.map(async (attempt, index): Promise<AttemptOutcome<T>> => {
      await waitForStart();
      try {
        return { index, status: 'fulfilled', value: await attempt() };
      } catch (reason) {
        return { index, reason, status: 'rejected' };
      }
    }),
  );
};

export interface ExactlyOneFulfilled<T> {
  readonly rejected: readonly RejectedAttempt[];
  readonly winner: FulfilledAttempt<T>;
}

/** Fails with a runner-neutral error when a race has zero or multiple winners. */
export const requireExactlyOneFulfilled = <T>(
  outcomes: readonly AttemptOutcome<T>[],
): ExactlyOneFulfilled<T> => {
  const fulfilled = outcomes.filter(
    (outcome): outcome is FulfilledAttempt<T> => outcome.status === 'fulfilled',
  );
  const rejected = outcomes.filter(
    (outcome): outcome is RejectedAttempt => outcome.status === 'rejected',
  );

  if (fulfilled.length !== 1) {
    throw new TestInvariantError('EXPECTED_EXACTLY_ONE_FULFILLED', {
      fulfilled: fulfilled.length,
      rejected: rejected.length,
      total: outcomes.length,
    });
  }

  const winner = fulfilled[0];
  if (!winner) {
    throw new TestInvariantError('FULFILLED_WINNER_MISSING');
  }
  return { rejected, winner };
};

export interface IdempotencyInvocation<TInput> {
  readonly input: TInput;
  readonly key: string;
}

export interface VerifyIdempotentReplayOptions<TInput, TResult> {
  readonly execute: (
    invocation: IdempotencyInvocation<TInput>,
  ) => Promise<TResult> | TResult;
  readonly input: TInput;
  readonly isEquivalent: (first: TResult, replay: TResult) => boolean;
  readonly key: string;
}

export interface IdempotentReplayResult<TResult> {
  readonly first: TResult;
  readonly key: string;
  readonly replay: TResult;
}

/** Executes the same key twice and rejects any observable replay drift. */
export const verifyIdempotentReplay = async <TInput, TResult>(
  options: VerifyIdempotentReplayOptions<TInput, TResult>,
): Promise<IdempotentReplayResult<TResult>> => {
  if (options.key.trim().length === 0) {
    throw new TestInvariantError('IDEMPOTENCY_KEY_REQUIRED');
  }

  const invocation = { input: options.input, key: options.key };
  const first = await options.execute(invocation);
  const replay = await options.execute(invocation);
  if (!options.isEquivalent(first, replay)) {
    throw new TestInvariantError('IDEMPOTENCY_REPLAY_MISMATCH', {
      key: options.key,
    });
  }
  return { first, key: options.key, replay };
};
