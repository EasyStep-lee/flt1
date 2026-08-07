import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const spec = JSON.parse(
  readFileSync(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
);

test('M1-P069 generates API-006 and API-007 from supplier DTO allowlists', () => {
  const login = spec.paths['/v1/supplier-auth/login'].post;
  const select = spec.paths['/v1/supplier-auth/workspaces/{accountId}/select'].post;

  assert.equal(login['x-fulishe-contract-id'], 'API-006');
  assert.equal(login['x-fulishe-idempotency'], 'requestId');
  assert.deepEqual(login.security, []);
  assert.equal(
    login.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/SupplierWorkspaceChoiceResponseDto',
  );
  assert.equal(select['x-fulishe-contract-id'], 'API-007');
  assert.equal(select['x-fulishe-idempotency'], 'selectionNonce');
  assert.deepEqual(select.security, []);
  assert.equal(
    select.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/SupplierSessionResponseDto',
  );

  const loginRequest = spec.components.schemas.SupplierLoginRequestDto.properties;
  assert.equal(loginRequest.password.writeOnly, true);
  assert.equal(loginRequest.verificationCode.writeOnly, true);
  const selectRequest =
    spec.components.schemas.SupplierSelectWorkspaceRequestDto.properties;
  assert.equal(selectRequest.selectionNonce.writeOnly, true);
  assert.equal(selectRequest.secondVerificationCode.writeOnly, true);

  const responseText = JSON.stringify({
    choice: spec.components.schemas.SupplierWorkspaceChoiceResponseDto,
    session: spec.components.schemas.SupplierSessionResponseDto,
  });
  assert.doesNotMatch(
    responseText,
    /supplierId|userId|identityId|password|sessionHash|sessionToken|loginAccountHash/iu,
  );
  assert.doesNotMatch(responseText, /supplyPrice|supplierPayable|grossMargin/iu);
});
