import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${name} requires a path`);
  }
  return path.resolve(repoRoot, value);
};

const expectedOpenApi = option(
  '--expected-openapi',
  path.join(repoRoot, 'packages', 'contracts', 'openapi.json'),
);
const expectedTypes = option(
  '--expected-types',
  path.join(repoRoot, 'packages', 'contracts', 'types.ts'),
);
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fulishe-openapi-check-'));
const actualOpenApi = path.join(temporaryRoot, 'openapi.json');
const actualTypes = path.join(temporaryRoot, 'types.ts');

try {
  const generation = spawnSync(
    process.execPath,
    [
      tsxCli,
      '--tsconfig',
      './apps/api/tsconfig.json',
      './scripts/generate-openapi.ts',
      '--openapi-output',
      actualOpenApi,
      '--types-output',
      actualTypes,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  if (generation.status !== 0) {
    process.stdout.write(generation.stdout ?? '');
    process.stderr.write(generation.stderr ?? '');
    throw new Error('OPENAPI_GENERATION_FAILED');
  }

  const failures = [];
  if (!readFileSync(expectedOpenApi).equals(readFileSync(actualOpenApi))) {
    failures.push('OPENAPI_SPEC_DRIFT');
  }
  if (!readFileSync(expectedTypes).equals(readFileSync(actualTypes))) {
    failures.push('OPENAPI_TYPES_DRIFT');
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write('OpenAPI generated artifacts are byte-identical.\n');
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
