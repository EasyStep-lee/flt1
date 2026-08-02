import assert from 'node:assert/strict';
import test from 'node:test';

import { createApplication } from '../../dist/bootstrap.js';

test(
  'unavailable infrastructure returns a bounded and secret-free readiness report',
  { timeout: 15_000 },
  async () => {
    assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
    assert.ok(process.env.REDIS_URL, 'REDIS_URL is required');

    const app = await createApplication({ env: process.env, logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    assert.equal(typeof address, 'object');

    try {
      const startedAt = Date.now();
      const response = await fetch(
        `http://127.0.0.1:${address.port}/health/ready`,
      );
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.status, 'DOWN');
      assert.ok(
        Object.values(body.checks).some((check) => check.status === 'DOWN'),
      );
      assert.ok(Date.now() - startedAt < 10_000);
      assert.doesNotMatch(
        JSON.stringify(body),
        /fulishe_mysql_dev_only|fulishe_redis_dev_only|DATABASE_URL|REDIS_URL/,
      );
    } finally {
      await app.close();
    }
  },
);
