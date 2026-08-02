import assert from 'node:assert/strict';
import test from 'node:test';

import { createApplication } from '../../dist/bootstrap.js';

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test(
  'real MySQL, Redis and BullMQ dependencies become ready',
  { timeout: 45_000 },
  async () => {
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
    assert.ok(process.env.REDIS_URL, 'REDIS_URL is required');

    const app = await createApplication({ env: process.env, logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    assert.equal(typeof address, 'object');
    const readyUrl = `http://127.0.0.1:${address.port}/health/ready`;

    try {
      let lastBody;
      for (let attempt = 1; attempt <= 30; attempt += 1) {
        const response = await fetch(readyUrl);
        lastBody = await response.json();
        if (response.status === 200) {
          break;
        }
        await sleep(500);
      }

      assert.equal(lastBody.status, 'UP', JSON.stringify(lastBody));
      assert.equal(lastBody.checks.database.status, 'UP');
      assert.equal(lastBody.checks.redis.status, 'UP');
      assert.equal(lastBody.checks.queue.status, 'UP');
    } finally {
      await app.close();
    }
  },
);
