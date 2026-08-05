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

test('M1-P004 evidence and execution ledgers stay at the verified boundary', async () => {
  const [evidence, projectState, taskLedger, p0Ledger, apiLedger] = await Promise.all([
    readFile(
      path.join(
        repositoryRoot,
        'artifacts',
        'verification',
        'M1-P004',
        'supplier-isolation.json',
      ),
      'utf8',
    ).then(JSON.parse),
    readFile(
      path.join(
        repositoryRoot,
        '福礼社Codex5.6开发执行包V1.1',
        '16-项目状态.json',
      ),
      'utf8',
    ).then(JSON.parse),
    readFile(
      path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '03-任务台账.csv'),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '04-P0-1至P0-119验收矩阵.csv'),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '12-OpenAPI-DTO-错误码台账.csv'),
      'utf8',
    ),
  ]);

  assert.equal(evidence.result, 'LOCAL_PASS');
  assert.equal(evidence.sourceState.verifiedImplementationHead, 'a33af8067c1ac17251223682a588a85292038630');
  assert.equal(evidence.fullVerification.stepsPassed, 17);
  assert.equal(evidence.evidenceBoundary.ci, 'NOT_EXECUTED');
  assert.deepEqual(evidence.contractBoundary.newMigrations, []);

  assert.equal(projectState.execution.currentTask, 'M1-P005');
  assert.equal(projectState.execution.nextAllowedTask, 'M1-P005');
  assert.equal(projectState.execution.lastCompletedTask, 'M1-P004');
  assert.equal(projectState.execution.activeTaskCount, 0);
  assert.match(taskLedger, /M1-P004[^\r\n]*DONE[^\r\n]*LOCAL_PASS/u);
  assert.match(taskLedger, /M1-P005[^\r\n]*READY[^\r\n]*NOT_EXECUTED/u);
  assert.match(p0Ledger, /P0-004[^\r\n]*LOCAL_PASS/u);
  assert.match(apiLedger, /API-008[^\r\n]*GET[^\r\n]*\/v1\/supplier\/me[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
});
