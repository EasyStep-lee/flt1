import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P004 freezes server-bound supplier scope without inventing resource CRUD', async () => {
  const [contract, policy, errorSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P004-supplier-isolation.md'),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, 'apps', 'api', 'src', 'supplier-scope', 'supplier-scope.policy.ts'),
      'utf8',
    ),
    readFile(path.join(repositoryRoot, 'apps', 'api', 'src', 'http', 'api-error.ts'), 'utf8'),
  ]);

  for (const marker of ['NEG-M1-004-01', 'NEG-M1-004-02', 'NEG-M1-004-03', 'NEG-M1-004-04']) {
    assert.match(contract, new RegExp(marker, 'u'));
  }
  for (const resource of ['SUPPLIER_PROFILE', 'PRODUCT', 'ORDER', 'INVENTORY', 'STATEMENT', 'ACCOUNT']) {
    assert.match(policy, new RegExp(resource, 'u'));
  }
  assert.match(errorSource, /SUPPLIER_SCOPE_FORBIDDEN/u);
  assert.match(errorSource, /DATA_SCOPE_FORBIDDEN/u);
  assert.match(contract, /不伪造.*CRUD/su);
});

test('M1-P004 generated API has no client supplier selector and returns an allowlisted DTO', async () => {
  const openapi = JSON.parse(
    await readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const operation = openapi.paths['/v1/supplier/me']?.get;
  assert.ok(operation);
  assert.deepEqual(operation.parameters, []);
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/SupplierProfileResponseDto',
  );

  const profile = JSON.stringify(openapi.components.schemas.SupplierProfileResponseDto);
  assert.doesNotMatch(
    profile,
    /companyId|supplierId|functionalAccountId|supplyPrice|approvedSupplyPrice|margin/iu,
  );
});
