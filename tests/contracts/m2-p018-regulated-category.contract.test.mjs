import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-018 exposes a company-only high-risk switch and keeps qualification references out of responses', () => {
  const list = openApi.paths['/v1/company/regulated-category-controls'].get;
  const enable = openApi.paths['/v1/company/regulated-category-controls/{categoryId}/enable'].post;
  const disable = openApi.paths['/v1/company/regulated-category-controls/{categoryId}/disable'].post;
  assert.equal(list.operationId, 'regulatedCategoryControls.list');
  assert.equal(enable.operationId, 'regulatedCategoryControls.enable');
  assert.equal(disable.operationId, 'regulatedCategoryControls.disable');
  assert.equal(enable.parameters.find(({ name }) => name === 'Idempotency-Key').required, true);
  const response = openApi.components.schemas.RegulatedCategoryControlResponseDto;
  assert.deepEqual(Object.keys(response.properties).sort(), [
    'categoryId',
    'companyQualificationReferenceCount',
    'disabledAt',
    'enabledAt',
    'id',
    'qualificationValidUntil',
    'status',
    'version',
  ]);
  assert.doesNotMatch(JSON.stringify(response), /references|objectKey|companyId|identityId/iu);
});

test('P0-018 freezes HIGH_RISK template mode, product qualification expiry and dedicated errors', () => {
  const template = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  assert.deepEqual(template.properties.regulatoryMode.enum, ['STANDARD', 'HIGH_RISK']);
  const product = openApi.components.schemas.SupplierProductDraftRequestDto;
  assert.equal(product.properties.qualificationValidUntil.format, 'date-time');
  const errors = JSON.stringify(openApi.components.schemas.ApiErrorResponseDto);
  assert.match(errors, /REGULATED_CATEGORY_DISABLED/u);
  assert.match(errors, /QUALIFICATION_REQUIRED/u);
  assert.match(errors, /CATEGORY_TEMPLATE_INVALID/u);
});
