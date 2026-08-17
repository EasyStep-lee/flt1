import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const evidencePath = path.join(root, 'artifacts', 'verification', 'M2-GATE', 'm2-gate-preflight.json');
const handoffPath = path.join(root, 'docs', 'handoffs', '2026-08-13-M2-gate-blocked-external.md');

const parseCsvLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  assert.equal(quoted, false, 'unterminated CSV field');
  values.push(value);
  return values;
};
const parseCsv = (source) => {
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const columns = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(columns.map((column, index) => [column, parseCsvLine(line)[index] ?? ''])));
};
const readJson = (file) => readFile(file, 'utf8').then(JSON.parse);

const m2P0Ids = [
  'P0-006', 'P0-007', 'P0-008', 'P0-009', 'P0-010', 'P0-011',
  'P0-012', 'P0-013', 'P0-014', 'P0-015', 'P0-016', 'P0-017',
  'P0-018', 'P0-019', 'P0-021', 'P0-061', 'P0-063', 'P0-071',
];

test('M2 gate binds all 18 technical P0 items and keeps merge-dependent acceptance locked', async () => {
  const evidence = await readJson(evidencePath);
  assert.equal(evidence.taskId, 'M2-GATE');
  assert.equal(evidence.stage, 'M2');
  assert.equal(evidence.candidate.mainSha, '7ea79b9fec8364aecbe5beeb12fc53d43be45690');
  assert.equal(evidence.p0.mappedCount, 18);
  assert.deepEqual(evidence.p0.items.map(({ p0Id }) => p0Id), m2P0Ids);
  assert.equal(evidence.p0.items.every(({ status }) => status === 'CI_PASS'), true);
  assert.equal(evidence.technicalChecks.failed.length, 0);
  assert.equal(evidence.externalItems.EXT007.status, 'PROVIDED');
  assert.equal(evidence.externalItems.EXT007.blocksStage, false);
  assert.equal(evidence.externalItems.EXT008.status, 'NOT_PROVIDED');
  assert.equal(evidence.decision.stagePassed, false);
  assert.equal(evidence.decision.conclusion, 'PENDING_EXACT_HEAD_CI_AND_MERGE');
  assert.equal(evidence.decision.lastPassedGate, 'M1-GATE');
  assert.equal(evidence.decision.nextAllowedTask, 'M2-GATE');
  assert.equal(evidence.decision.m3Unlocked, false);
  assert.equal(evidence.environment.staging, 'NOT_EXECUTED');
  assert.equal(evidence.environment.device, 'NOT_EXECUTED');
  assert.equal(evidence.environment.production, 'NOT_EXECUTED');
});

test('M2 gate ledgers close only after exact-head merge and main CI evidence', async () => {
  const [tasks, stages, externals, state] = await Promise.all([
    readFile(path.join(pack, '03-任务台账.csv'), 'utf8').then(parseCsv),
    readFile(path.join(pack, 'data', '阶段门禁.csv'), 'utf8').then(parseCsv),
    readFile(path.join(pack, '09-外部依赖与人工事项.csv'), 'utf8').then(parseCsv),
    readJson(path.join(pack, '16-项目状态.json')),
  ]);
  const gate = tasks.find(({ TaskID }) => TaskID === 'M2-GATE');
  const m2 = stages.find(({ Stage }) => Stage === 'M2');
  const m3 = stages.find(({ Stage }) => Stage === 'M3');
  const ext007 = externals.find(({ DependencyID }) => DependencyID === 'EXT-007');
  assert.equal(gate.Status, 'DONE');
  assert.equal(gate.EvidenceStatus, 'CI_PASS');
  assert.equal(gate.CI, 'CI_PASS');
  assert.equal(m2.Status, 'GATE_PASSED');
  assert.equal(m2.EvidenceStatus, 'CI_PASS');
  assert.equal(m3.Status, 'IN_PROGRESS');
  assert.equal(['LOCAL_PASS', 'CI_PASS'].includes(m3.EvidenceStatus), true);
  assert.equal(ext007.CurrentStatus, 'PROVIDED');
  assert.equal(ext007.BlocksFormalAcceptance, 'YES');
  assert.equal(state.execution.currentTask, 'M3-P055');
  assert.equal(state.execution.nextAllowedTask, 'M3-P055');
  assert.equal(state.execution.lastPassedGate, 'M2-GATE');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P055.*M3-P056/u);
});

test('M2 gate handoff states the technical boundary without claiming PASS', async () => {
  const handoff = await readFile(handoffPath, 'utf8');
  assert.match(handoff, /^# M2-GATE 阶段门禁未完成交接/u);
  assert.match(handoff, /阶段结论：`BLOCKED_EXTERNAL`/u);
  assert.match(handoff, /EXT-007/u);
  assert.match(handoff, /7ea79b9fec8364aecbe5beeb12fc53d43be45690/u);
  assert.match(handoff, /31663228561/u);
  assert.match(handoff, /M3.*锁定/u);
  assert.match(handoff, /staging.*`NOT_EXECUTED`/iu);
  assert.match(handoff, /真机.*`NOT_EXECUTED`/u);
  assert.match(handoff, /生产.*`NOT_EXECUTED`/u);
  assert.doesNotMatch(handoff, /阶段结论：`PASS`|M2-GATE[^\r\n]*GATE_PASSED|M3[^\r\n]*(?:已解锁|可开始)/u);
});
