import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P067 remains bound to its merged evidence after P070 starts', async () => {
  const [contract, evidence, rehearsal, state, tasks, p0, pages, migrations, apis, ledger] =
    await Promise.all([
      readFile(
        path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P067-company-workspaces.md'),
        'utf8',
      ),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P067',
          'company-workspaces.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P067',
          'prisma-migration-rehearsal.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(packRoot, '11-数据库迁移台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '10-测试证据登记.csv'), 'utf8'),
    ]);

  for (const marker of [
    'NEG-M1-067-01',
    'NEG-M1-067-02',
    'NEG-M1-067-03',
    'NEG-M1-067-04',
    '__Host-fulishe-company-admin',
    'API-082',
    'M1-P068',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.ok(['IN_PROGRESS', 'LOCAL_PASS'].includes(evidence.status));
  assert.equal(evidence.scope.fixedWorkspaceCount, 10);
  assert.equal(evidence.scope.businessWorkspaceContentsImplemented, false);
  assert.equal(evidence.contract.menuCardinality, 1);
  assert.equal(evidence.negativeTests.length, 4);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.equal(evidence.migration.rehearsal, 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_8_CLEANUP_PASS');

  assert.equal(rehearsal.productRehearsal.taskId, 'M1-P067');
  assert.deepEqual(rehearsal.productRehearsal.companyFixedWorkspaces, {
    activeAccountTypeCount: 10,
    uniqueWorkspaceRouteCount: 10,
    exactCodeRoutePairCount: 10,
    singleMenuSchemaCount: 10,
  });
  assert.equal(rehearsal.productRehearsal.finalSchemaDrift, 'NONE');
  assert.equal(rehearsal.cleanup.errors.length, 0);

  assert.equal(state.execution.currentTask, 'M2-P009');
  assert.equal(state.execution.nextAllowedTask, 'M2-P009');
  assert.ok([0, 1].includes(state.execution.activeTaskCount));
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-P009');
  assert.equal(state.github.currentTaskDelivery.issue, 43);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P009.*M2-P010/u);

  assert.match(tasks, /M1-P067[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-GATE[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P068[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P069[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P072[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-067[^\r\n]*CI_PASS/u);
  assert.match(pages, /PAGE-003[^\r\n]*P0-067_CI_PASS[^\r\n]*P0-068_CI_PASS/u);
  assert.match(pages, /PAGE-012[^\r\n]*P0-067_CI_PASS[^\r\n]*P0-068_CI_PASS[^\r\n]*P0-072_LOCAL_PASS/u);
  assert.match(migrations, /MIG-002[^\r\n]*APPLIED_LOCAL/u);
  assert.match(apis, /API-013[^\r\n]*P0-067[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-014[^\r\n]*P0-067[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-082[^\r\n]*P0-067[^\r\n]*IMPLEMENTED/u);
  assert.match(ledger, /EVD-067[^\r\n]*CI_PASS/u);
});
