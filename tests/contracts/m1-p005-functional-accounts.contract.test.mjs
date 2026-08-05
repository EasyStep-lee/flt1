import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P005 generated OpenAPI implements API-013 and API-014 with response allowlists', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const pathItem = openapi.paths['/v1/{ownerType}/functional-accounts'];
  assert.ok(pathItem?.get);
  assert.ok(pathItem?.post);
  assert.equal(pathItem.get.operationId, 'functionalAccounts.list');
  assert.equal(pathItem.post.operationId, 'functionalAccounts.create');
  assert.ok(pathItem.post.responses['428']);
  assert.ok(
    pathItem.post.parameters.some(
      (parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key',
    ),
  );

  const responseSchema = JSON.stringify(
    openapi.components.schemas.FunctionalAccountResponseDto,
  );
  for (const field of [
    'id',
    'displayName',
    'accountTypeCode',
    'accountTypeName',
    'workspaceRoute',
    'status',
    'expiresAt',
    'lastLoginAt',
  ]) {
    assert.match(responseSchema, new RegExp(field, 'u'));
  }
  assert.doesNotMatch(
    responseSchema,
    /supplierId|companyId|identityId|mobile|email|supplyPrice|margin/iu,
  );
});

test('M1-P005 portal maps PAGE-016 and PAGE-024 without implementing later workspace shells', async () => {
  const source = await readFile(
    path.join(repositoryRoot, 'apps', 'supplier-portal', 'src', 'app.tsx'),
    'utf8',
  );
  assert.match(source, /data-page-id="PAGE-016"/u);
  assert.match(source, /data-page-id="PAGE-024"/u);
  assert.match(source, /\/supplier\/workspaces\/account-admin\/accounts/u);
  assert.match(source, /SECOND_VERIFICATION_REQUIRED/u);
  assert.doesNotMatch(source, /供应价|毛利|供应商应付/u);
});

test('M1-P005 implementation contract names every frozen negative check', async () => {
  const contract = await readFile(
    path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P005-functional-accounts.md'),
    'utf8',
  );
  for (const marker of [
    'NEG-M1-005-01',
    'NEG-M1-005-02',
    'NEG-M1-005-03',
    'NEG-M1-005-04',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }
  assert.match(contract, /M1-P069/u);
  assert.match(contract, /M1-P070/u);
});

