import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P072 exposes deterministic sensitive approval operations with explicit DTO allowlists', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const expected = [
    ['post', '/v1/audit/sensitive-export-approvals'],
    ['get', '/v1/audit/sensitive-export-approvals'],
    ['post', '/v1/audit/sensitive-export-approvals/{taskId}/claim'],
    ['post', '/v1/audit/sensitive-export-approvals/{taskId}/decision'],
  ];
  for (const [method, route] of expected) {
    assert.ok(openapi.paths[route]?.[method], `${method.toUpperCase()} ${route} missing`);
  }
  const schemas = openapi.components.schemas;
  const response = JSON.stringify(schemas.SensitiveApprovalTaskResponseDto);
  for (const field of ['id', 'approvalType', 'resource', 'status', 'version', 'createdAt']) {
    assert.match(response, new RegExp(`"${field}"`, 'u'));
  }
  assert.doesNotMatch(
    response,
    /applicantId|reviewedBy|functionalAccountId|supplierId|companyId|supplyPrice|bankAccount/iu,
  );
  const catalog = JSON.stringify(openapi);
  for (const code of [
    'SAME_NATURAL_PERSON_REVIEW',
    'SECOND_REVIEW_REQUIRED',
    'APPROVAL_VERSION_CONFLICT',
    'AUDIT_REQUIRED',
  ]) {
    assert.match(catalog, new RegExp(code, 'u'));
  }
});
