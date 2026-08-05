import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else current += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      values.push(current);
      current = '';
    } else current += character;
  }
  values.push(current);
  return values;
};

const readCsv = async (relativePath) => {
  const source = await readFile(path.join(packRoot, relativePath), 'utf8');
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, values[index] ?? '']));
  });
};

test('M1-P001 closes in CI and leaves only M1-P002 in progress', async () => {
  const [tasks, state] = await Promise.all([
    readCsv('03-任务台账.csv'),
    readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
  ]);
  const active = tasks.filter(({ Status }) => Status === 'IN_PROGRESS');
  const m1p001 = tasks.find(({ TaskID }) => TaskID === 'M1-P001');
  const m1p002 = tasks.find(({ TaskID }) => TaskID === 'M1-P002');

  assert.deepEqual(active.map(({ TaskID }) => TaskID), ['M1-P002']);
  assert.equal(m1p001?.Status, 'DONE');
  assert.equal(m1p001?.EvidenceStatus, 'CI_PASS');
  assert.equal(
    m1p001?.CommitSHA,
    '7eb91066846204a18afa20c4c8b4c7b94676dca0',
  );
  assert.equal(m1p001?.PullRequest, '8');
  assert.equal(m1p001?.CI, 'CI_PASS');
  assert.equal(m1p002?.Status, 'IN_PROGRESS');
  assert.equal(m1p002?.EvidenceStatus, 'NOT_EXECUTED');
  assert.equal(state.execution.currentTask, 'M1-P002');
  assert.equal(state.execution.nextAllowedTask, 'M1-P002');
  assert.equal(state.execution.activeTaskCount, 1);
  assert.equal(state.execution.lastCompletedTask, 'M1-P001');
  assert.equal(
    state.execution.lastCompletedCommit,
    '7eb91066846204a18afa20c4c8b4c7b94676dca0',
  );
  assert.equal(state.github.pullRequest, 8);
  assert.equal(
    state.github.latestCi.headSha,
    'c2b4bf420d0629b795cdfbdf2c1c4378224d76f7',
  );
});

test('P0-001 maps its page, API, errors and runnable evidence', async () => {
  const [pages, apis, p0Rows, evidence] = await Promise.all([
    readCsv('08-页面路由接口P0映射.csv'),
    readCsv('12-OpenAPI-DTO-错误码台账.csv'),
    readCsv('04-P0-1至P0-119验收矩阵.csv'),
    readFile(
      path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P001', 'single-merchant.json'),
      'utf8',
    ).then(JSON.parse),
  ]);

  const home = pages.find(({ Route }) => Route === '/');
  const api = apis.find(({ Path }) => Path === '/v1/public/merchant-profile');
  const p0 = p0Rows.find(({ P0ID }) => P0ID === 'P0-001');

  assert.match(home?.P0 ?? '', /P0-001/u);
  assert.equal(api?.RequestDTO, 'PublicMerchantProfileQuery');
  assert.equal(api?.ResponseDTO, 'PublicMerchantProfileResponse');
  assert.match(api?.ErrorCodes ?? '', /SELLER_IDENTITY_FORBIDDEN/u);
  assert.match(api?.ErrorCodes ?? '', /PAYEE_FORBIDDEN/u);
  assert.match(api?.ErrorCodes ?? '', /SINGLE_MERCHANT_VIOLATION/u);
  assert.equal(p0?.CurrentEvidenceStatus, 'CI_PASS');
  assert.equal(evidence.taskId, 'M1-P001');
  assert.equal(evidence.p0Id, 'P0-001');
  assert.equal(evidence.result, 'CI_PASS');
  assert.deepEqual(
    evidence.negativeTests.map(({ id, status }) => ({ id, status })),
    [
      { id: 'NEG-M1-001-01', status: 'PASS' },
      { id: 'NEG-M1-001-02', status: 'PASS' },
      { id: 'NEG-M1-001-03', status: 'PASS' },
    ],
  );
});
