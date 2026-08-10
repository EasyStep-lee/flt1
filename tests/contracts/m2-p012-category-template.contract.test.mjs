import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('API-018 exposes private versioned category-template DTO whitelists and operations', () => {
  const collection = openApi.paths['/v1/company/categories/{categoryId}/template-versions'];
  const item = openApi.paths['/v1/company/category-template-versions/{templateId}'];
  const publish = openApi.paths['/v1/company/category-template-versions/{templateId}/publish'];
  assert.equal(collection.get.operationId, 'companyCategoryTemplates.list');
  assert.equal(collection.post.operationId, 'companyCategoryTemplates.createDraft');
  assert.equal(item.patch.operationId, 'companyCategoryTemplates.patchDraft');
  assert.equal(publish.post.operationId, 'companyCategoryTemplates.publish');
  assert.equal(
    collection.get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/CategoryTemplateListResponseDto',
  );
  assert.deepEqual(
    Object.keys(openApi.components.schemas.CategoryTemplateResponseDto.properties).sort(),
    [
      'afterSaleRules',
      'categoryId',
      'createdAt',
      'detailModules',
      'fieldSchema',
      'id',
      'publishedAt',
      'qualificationRules',
      'retiredAt',
      'revision',
      'skuDimensions',
      'status',
      'version',
    ],
  );
  assert.deepEqual(
    Object.keys(openApi.components.schemas.CategoryTemplateCreateRequestDto.properties).sort(),
    ['afterSaleRules', 'detailModules', 'fieldSchema', 'qualificationRules', 'skuDimensions'],
  );
  const templateSchemas = Object.fromEntries(
    Object.entries(openApi.components.schemas).filter(([name]) =>
      name.startsWith('CategoryTemplate') || name.startsWith('Template'),
    ),
  );
  const contract = JSON.stringify({ collection, item, publish, schemas: templateSchemas });
  assert.doesNotMatch(
    contract,
    /companyId|functionalAccountId|identityId|approvedSupplyPrice|supplyPrice|settlement|margin/iu,
  );
});

test('category-template mutations require fixed company product-ops authorization and idempotency', () => {
  for (const operation of [collectionOperation('post'), itemOperation('patch'), publishOperation()]) {
    assert.ok(operation.parameters.some(({ in: location, name }) => location === 'header' && name === 'Idempotency-Key'));
    assert.ok(operation.responses['401']);
    assert.ok(operation.responses['403']);
    assert.ok(operation.responses['409']);
    assert.ok(operation.responses['422']);
  }
  assert.equal(openApi.paths['/v1/supplier/category-template-versions'], undefined);
  assert.equal(openApi.paths['/v1/public/category-template-versions'], undefined);
});

function collectionOperation(method) {
  return openApi.paths['/v1/company/categories/{categoryId}/template-versions'][method];
}

function itemOperation(method) {
  return openApi.paths['/v1/company/category-template-versions/{templateId}'][method];
}

function publishOperation() {
  return openApi.paths['/v1/company/category-template-versions/{templateId}/publish'].post;
}
