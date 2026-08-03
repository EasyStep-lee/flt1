import { describe, expect, it } from 'vitest';

import {
  requireExactlyOneFulfilled,
  runConcurrently,
  verifyIdempotentReplay,
} from '../src/index.js';

describe('runner-neutral concurrency probes', () => {
  it('starts every registered attempt before the shared work is released', async () => {
    let started = 0;
    let release: (() => void) | undefined;
    const workReleased = new Promise<void>((resolve) => {
      release = resolve;
    });

    const outcomes = await runConcurrently(
      ['a', 'b', 'c'].map((actor) => async () => {
        started += 1;
        if (started === 3) release?.();
        await workReleased;
        return actor;
      }),
    );

    expect(started).toBe(3);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
  });

  it('exactly one concurrent attempt succeeds', async () => {
    let claimedBy: string | undefined;
    const outcomes = await runConcurrently(
      ['runner-a', 'runner-b', 'runner-c'].map((actor) => async () => {
        if (claimedBy) throw new Error(`ALREADY_CLAIMED:${claimedBy}`);
        claimedBy = actor;
        await Promise.resolve();
        return actor;
      }),
    );

    const result = requireExactlyOneFulfilled(outcomes);
    expect(result.winner.value).toBe(claimedBy);
    expect(result.rejected).toHaveLength(2);
  });

  it('rejects a race without exactly one winner', () => {
    expect(() =>
      requireExactlyOneFulfilled([
        { index: 0, status: 'fulfilled', value: 'a' },
        { index: 1, status: 'fulfilled', value: 'b' },
      ]),
    ).toThrowError(
      expect.objectContaining({ code: 'EXPECTED_EXACTLY_ONE_FULFILLED' }),
    );
  });
});

describe('runner-neutral idempotency probes', () => {
  it('same idempotency key replays the original result', async () => {
    const stored = new Map<string, { readonly sequence: number }>();
    let sideEffects = 0;

    const result = await verifyIdempotentReplay({
      key: 'fixture-key-0001',
      input: { fixture: true },
      execute: ({ key }) => {
        const existing = stored.get(key);
        if (existing) return existing;
        sideEffects += 1;
        const created = { sequence: sideEffects };
        stored.set(key, created);
        return created;
      },
      isEquivalent: (first, replay) => first.sequence === replay.sequence,
    });

    expect(result.first).toEqual({ sequence: 1 });
    expect(result.replay).toEqual({ sequence: 1 });
    expect(sideEffects).toBe(1);
  });

  it('reports replay drift instead of hiding it', async () => {
    let sequence = 0;
    await expect(
      verifyIdempotentReplay({
        key: 'fixture-key-0002',
        input: null,
        execute: () => ({ sequence: (sequence += 1) }),
        isEquivalent: (first, replay) => first.sequence === replay.sequence,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_REPLAY_MISMATCH' });
  });
});
