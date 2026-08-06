import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const spec = JSON.parse(
  readFileSync(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
);

test('M1-P066 generates API-003 and API-004 from explicit DTO allowlists', () => {
  const login = spec.paths['/v1/company-auth/login'].post;
  const select = spec.paths['/v1/company-auth/workspaces/{accountId}/select'].post;

  assert.equal(login['x-fulishe-contract-id'], 'API-003');
  assert.equal(login['x-fulishe-idempotency'], 'requestId');
  assert.deepEqual(login.security, []);
  assert.equal(
    login.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/WorkspaceChoiceResponseDto',
  );
  assert.equal(select['x-fulishe-contract-id'], 'API-004');
  assert.equal(select['x-fulishe-idempotency'], 'selectionNonce');
  assert.deepEqual(select.security, []);
  assert.equal(
    select.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/SessionResponseDto',
  );

  const loginRequest = spec.components.schemas.CompanyLoginRequestDto.properties;
  assert.equal(loginRequest.password.writeOnly, true);
  assert.equal(loginRequest.verificationCode.writeOnly, true);
  const selectRequest = spec.components.schemas.SelectWorkspaceRequestDto.properties;
  assert.equal(selectRequest.selectionNonce.writeOnly, true);
  assert.equal(selectRequest.secondVerificationCode.writeOnly, true);

  const responseText = JSON.stringify({
    choice: spec.components.schemas.WorkspaceChoiceResponseDto,
    session: spec.components.schemas.SessionResponseDto,
  });
  assert.doesNotMatch(responseText, /password|sessionHash|sessionToken|loginAccountHash/iu);
  assert.doesNotMatch(responseText, /supplyPrice|supplierPayable|grossMargin/iu);
});
