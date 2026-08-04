import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const freezePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-000',
  'm1-contract-freeze.json',
);

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
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const encodeCsvCell = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const updateCsv = async (relativePath, updateRow) => {
  const filePath = path.join(executionPackRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/u);
  const header = parseCsvLine(lines[0]);
  const updatedLines = [lines[0]];

  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
    const updated = updateRow({ ...row });
    if (updated === null) {
      updatedLines.push(line);
      continue;
    }
    updatedLines.push(header.map((column) => encodeCsvCell(updated[column])).join(','));
  }

  await writeFile(filePath, `${updatedLines.join(lineEnding)}${lineEnding}`, 'utf8');
};

const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const fieldByKey = new Map(
  freeze.fieldContract.entities.flatMap(({ entity, fields }) =>
    fields.map((field) => [`${entity}.${field.name}`, field]),
  ),
);
const negativeByP0 = new Map(
  freeze.scope.p0Ids.map((p0Id) => [
    p0Id,
    freeze.negativeTests.filter((negativeTest) => negativeTest.p0Id === p0Id),
  ]),
);

await updateCsv('05-字段字典初始版.csv', (row) => {
  if (row.Stage !== 'M1') return null;
  const frozenField = fieldByKey.get(`${row.Entity}.${row.Field}`);
  if (!frozenField) throw new Error(`M1_FIELD_NOT_FROZEN:${row.Entity}.${row.Field}`);
  row.SuggestedType = frozenField.type;
  row.UnitOrFormat = frozenField.format;
  row.Sensitivity = frozenField.sensitivity;
  row.Validation = frozenField.validation;
  row.P0 = frozenField.p0Ids.join(',');
  row.Status = 'FROZEN_M1_000';
  return row;
});

await updateCsv('06-状态机总表.csv', (row) => {
  if (row.Stage !== 'M1') return null;
  row.Status = 'FROZEN_M1_000';
  return row;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.Stage !== 'M1') return null;
  const plannedNegatives = negativeByP0.get(row.P0ID);
  if (!plannedNegatives) throw new Error(`M1_P0_NEGATIVE_PLAN_MISSING:${row.P0ID}`);
  row.AutomatedTestID = plannedNegatives.map(({ id }) => id).join('|');
  row.NegativeChecks = plannedNegatives.map(({ category }) => category).join('；');
  row.EvidenceLink = 'artifacts/verification/M1-000/m1-contract-freeze.json#negativeTests';
  row.Notes = 'M1-000仅冻结测试ID与场景；对应业务切片须先写失败测试；当前仍为NOT_EXECUTED';
  return row;
});

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.Stage !== 'M1') return null;
  row.ContractTest =
    'FREEZE:tests/contracts/m1-contract-freeze.contract.test.mjs;RUNTIME:TO_BE_CREATED';
  row.Notes = 'M1-000已冻结DTO、错误码、权限、幂等与字段策略；OpenAPI和运行时实现仍为PLANNED';
  return row;
});
