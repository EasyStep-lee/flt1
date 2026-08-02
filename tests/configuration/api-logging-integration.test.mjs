import assert from 'node:assert/strict';
import test from 'node:test';

import { SafeJsonLogger } from '../../apps/api/dist/logging/safe-json.logger.js';

test('API logger preserves safe structure while removing nested secrets', () => {
  const lines = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };

  try {
    new SafeJsonLogger().log({
      event: 'configuration.rejected',
      password: 'must-never-appear',
      nested: {
        authorization: 'Bearer must-never-appear',
        requestId: 'safe-request-id',
      },
    });
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.equal(payload.message.event, 'configuration.rejected');
  assert.equal(payload.message.password, '[REDACTED]');
  assert.equal(payload.message.nested.authorization, '[REDACTED]');
  assert.equal(payload.message.nested.requestId, 'safe-request-id');
  assert.doesNotMatch(lines[0], /must-never-appear/);
});
