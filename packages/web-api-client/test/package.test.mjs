import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebApiClient } from '../dist/index.js';

test('web API client can be created without sending a request', () => {
  const client = createWebApiClient({ baseUrl: 'https://contract.invalid' });
  assert.equal(typeof client.GET, 'function');
  assert.equal(typeof client.POST, 'function');
});
