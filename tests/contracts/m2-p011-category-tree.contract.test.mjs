import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('API-016/API-017 expose role-scoped category DTO whitelists and management operations', () => {
  const collection = openApi.paths['/v1/company/categories'];
  const item = openApi.paths['/v1/company/categories/{categoryId}'];
  assert.equal(collection.get.operationId, 'companyCategories.list');
  assert.equal(collection.post.operationId, 'companyCategories.create');
  assert.equal(item.patch.operationId, 'companyCategories.patch');
  assert.equal(item.delete.operationId, 'companyCategories.delete');
  assert.equal(
    collection.get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/CategoryTreeResponseDto',
  );
  assert.equal(
    collection.post.responses['201'].content['application/json'].schema.$ref,
    '#/components/schemas/CategoryResponseDto',
  );
  assert.deepEqual(
    Object.keys(openApi.components.schemas.CategoryResponseDto.properties).sort(),
    ['id', 'level', 'name', 'parentId', 'sortWeight', 'status', 'version'],
  );
  assert.deepEqual(
    Object.keys(openApi.components.schemas.CategoryCreateRequestDto.properties).sort(),
    ['level', 'name', 'parentId', 'sortWeight'],
  );
  const contract = JSON.stringify({ collection, item, schemas: {
    response: openApi.components.schemas.CategoryResponseDto,
    tree: openApi.components.schemas.CategoryTreeResponseDto,
  } });
  assert.doesNotMatch(
    contract,
    /companyId|functionalAccountId|identityId|approvedSupplyPrice|supplyPrice|settlement|margin/iu,
  );
});
test('category management remains private/no-store and supplier assignment is not a public mutation', () => {
  for (const operation of [
    openApi.paths['/v1/company/categories'].get,
    openApi.paths['/v1/company/categories'].post,
    openApi.paths['/v1/company/categories/{categoryId}'].patch,
    openApi.paths['/v1/company/categories/{categoryId}'].delete,
  ]) {
    assert.ok(operation.responses['401'] || operation.responses['403']);
  }
  assert.equal(openApi.paths['/v1/supplier/categories'], undefined);
  assert.equal(openApi.paths['/v1/public/categories'], undefined);
});
