import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const forbiddenFields = [
  'communityId',
  'communityScope',
  'leaderId',
  'leaderCommission',
  'campaignStartAt',
  'campaignEndAt',
  'countdownAt',
  'groupThreshold',
  'groupMemberCount',
  'groupStatus',
  'budgetApprovalId',
  'procurementApprovalFlowId',
  'oaWorkflowId',
];

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

test('M3-P030 keeps group-buying and enterprise workflow fields out of Prisma and OpenAPI', async () => {
  const [schema, openapiText] = await Promise.all([
    readFile(new URL('../../packages/db/prisma/schema.prisma', import.meta.url), 'utf8'),
    readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
  ]);
  const openapiKeys = collectKeys(JSON.parse(openapiText));

  for (const field of forbiddenFields) {
    assert.doesNotMatch(schema, new RegExp(`^\\s*${field}\\s+`, 'mu'));
    assert.equal(openapiKeys.has(field), false, `${field} must not become an API field`);
  }
});
