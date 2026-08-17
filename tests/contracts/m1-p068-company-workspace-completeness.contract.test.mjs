import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P068 remains bound to merged evidence after P070 starts', async () => {
  const [contract, evidence, state, tasks, p0, pages, apis, openapi] = await Promise.all([
    readFile(
      path.join(
        repositoryRoot,
        'docs',
        'contracts',
        'm1',
        'M1-P068-company-workspace-completeness.md',
      ),
      'utf8',
    ),
    readFile(
      path.join(
        repositoryRoot,
        'artifacts',
        'verification',
        'M1-P068',
        'company-workspace-completeness.json',
      ),
      'utf8',
    ).then(JSON.parse),
    readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
    readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
    readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
    readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
    readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
    readFile(path.join(repositoryRoot, 'packages', 'contracts', 'openapi.json'), 'utf8').then(
      JSON.parse,
    ),
  ]);

  for (const marker of [
    'NEG-M1-068-01',
    'NEG-M1-068-02',
    'NEG-M1-068-03',
    'API-083',
    'M1-P069',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.scope.companyWorkspaceCount, 10);
  assert.equal(evidence.scope.laterBusinessDataImplemented, false);
  assert.equal(evidence.contract.contextSource, 'SERVER_SESSION_ONLY');
  assert.equal(evidence.contract.moduleCatalogIsolation, 'ROLE_SCOPED');
  assert.deepEqual(evidence.uiStates, [
    'loading',
    'empty',
    'error',
    'permission-denied',
    'offline-or-timeout',
    'success',
  ]);
  assert.equal(evidence.negativeTests.length, 3);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.deepEqual(evidence.migration.newMigrations, []);

  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-P055');
  assert.equal(state.execution.nextAllowedTask, 'M3-P055');
  assert.equal(state.execution.lastCompletedTask, 'M3-P054');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P055');
  assert.equal(state.github.currentTaskDelivery.issue, 107);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P055.*M3-P056/u);

  assert.match(tasks, /M1-P067[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P068[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P069[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P072[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-068[^\r\n]*CI_PASS/u);
  assert.match(pages, /PAGE-003[^\r\n]*IMPLEMENTED[^\r\n]*P0-068_CI_PASS/u);
  assert.match(pages, /PAGE-012[^\r\n]*IMPLEMENTED[^\r\n]*P0-068_CI_PASS/u);
  assert.match(apis, /API-083[^\r\n]*P0-068[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);

  const operation = openapi.paths['/v1/company-auth/workspace/page']?.get;
  assert.equal(operation?.['x-fulishe-contract-id'], 'API-083');
  assert.equal(operation?.security?.[0]?.companyFunctionalSession?.length, 0);
  assert.equal(
    operation?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/CompanyWorkspacePageResponseDto',
  );
});
