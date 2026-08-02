import assert from 'node:assert/strict';
import test from 'node:test';

import { MiniappTransportError, createMiniappRequestAdapter } from '../dist/index.js';

test('adapter delegates through the injected mini-program runtime exactly once', async () => {
  let calls = 0;
  const runtime = {
    request(options) {
      calls += 1;
      options.success({ data: { ready: true }, statusCode: 200 });
    },
  };
  const adapter = createMiniappRequestAdapter(runtime);
  const response = await adapter.execute('shell.probe', { url: '/shell/probe' });
  assert.deepEqual(response, { ready: true });
  assert.equal(calls, 1);
});

test('adapter rejects non-success status without exposing a low-level message', async () => {
  const runtime = {
    request(options) {
      options.success({ data: { secret: 'must-not-escape' }, statusCode: 503 });
    },
  };
  const adapter = createMiniappRequestAdapter(runtime);
  await assert.rejects(
    adapter.execute('shell.probe', { url: '/shell/probe' }),
    (error) =>
      error instanceof MiniappTransportError &&
      error.code === 'MINIAPP_HTTP_ERROR' &&
      error.message === 'MINIAPP_HTTP_ERROR' &&
      !error.message.includes('secret'),
  );
});
