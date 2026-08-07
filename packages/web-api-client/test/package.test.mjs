import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCookieBoundWebApiClient,
  createWebApiClient,
} from '../dist/index.js';

test('web API client can be created without sending a request', () => {
  const client = createWebApiClient({ baseUrl: 'https://contract.invalid' });
  assert.equal(typeof client.GET, 'function');
  assert.equal(typeof client.POST, 'function');
});

test('cookie-bound API client includes credentials for an independent API origin', async () => {
  const requests = [];
  const client = createCookieBoundWebApiClient({
    baseUrl: 'https://api.contract.invalid',
    fetch: async (request) => {
      requests.push(request);
      return new Response(JSON.stringify({ status: 'UP' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    },
  });

  await client.GET('/health/live');

  assert.equal(requests.length, 1);
  assert.equal(requests[0].credentials, 'include');
});
