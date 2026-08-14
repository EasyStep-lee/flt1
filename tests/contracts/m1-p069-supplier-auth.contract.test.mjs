import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P069 remains recorded after its exact-head merge and P070 takeover', async () => {
  const [contract, evidence, state, tasks, p0, pages, migrations, apis, openapi] =
    await Promise.all([
      readFile(
        path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P069-supplier-auth.md'),
        'utf8',
      ),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P069',
          'supplier-auth.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(packRoot, '11-数据库迁移台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8').then(
        JSON.parse,
      ),
    ]);

  for (const marker of [
    'NEG-M1-069-01',
    'NEG-M1-069-02',
    'NEG-M1-069-03',
    'NEG-M1-069-04',
    'API-006',
    'API-007',
    'PAGE-013',
    'PAGE-014',
    'PAGE-015',
    'M1-P070',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.scope.supplierRegistrationReusedFrom, 'M1-P003');
  assert.equal(evidence.scope.supplierWorkspacePagesImplemented, false);
  assert.equal(evidence.scope.nextTaskAllowed, false);
  assert.equal(evidence.contract.supplierOwnership, 'SERVER_SESSION_ONLY');
  assert.equal(evidence.contract.functionalSession, 'ONE_ACTIVE_ACCOUNT_PER_SESSION');
  assert.equal(evidence.contract.ambiguousLoginIdentifier, 'FAIL_CLOSED_NON_ENUMERATING');
  assert.equal(evidence.negativeTests.length, 4);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.equal(evidence.fullVerification.status, 'PASS_17_OF_17');
  assert.equal(evidence.fullVerification.stepsPassed, 17);
  assert.deepEqual(evidence.migration.newMigrations, [
    '20260807010000_supplier_auth_sessions',
  ]);

  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-P020');
  assert.equal(state.execution.nextAllowedTask, 'M3-P020');
  assert.equal(state.execution.lastCompletedTask, 'M3-000');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P020');
  assert.equal(state.github.currentTaskDelivery.issue, 77);
  assert.equal(state.github.previousTaskDelivery.taskId, 'M3-000');
  assert.equal(
    state.github.previousTaskDelivery.exactHead,
    '78eeade32d868b32d544230d218a90ef9f259c01',
  );
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P020.*M3-P022/u);

  assert.match(tasks, /M1-P068[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P069[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P072[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-069[^\r\n]*CI_PASS/u);
  assert.match(pages, /PAGE-013[^\r\n]*IMPLEMENTED[^\r\n]*P0-069_LOCAL_PASS/u);
  assert.match(pages, /PAGE-014[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(pages, /PAGE-015[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(migrations, /MIG-002[^\r\n]*SupplierAuthSelection[^\r\n]*APPLIED_LOCAL/u);
  assert.match(apis, /API-006[^\r\n]*P0-069[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-007[^\r\n]*P0-069,P0-070[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);

  const login = openapi.paths['/v1/supplier-auth/login']?.post;
  const select = openapi.paths['/v1/supplier-auth/workspaces/{accountId}/select']?.post;
  assert.equal(login?.['x-fulishe-contract-id'], 'API-006');
  assert.deepEqual(login?.security, []);
  assert.equal(select?.['x-fulishe-contract-id'], 'API-007');
  assert.deepEqual(select?.security, []);
  assert.equal(
    select?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/SupplierSessionResponseDto',
  );
});
