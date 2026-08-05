import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const checkerPath = path.join(
  repositoryRoot,
  'scripts',
  'check-prisma-migrations.mjs',
);
const m0010Commit = '62ead13dfb9c6680a4c173fa09377ce6cf8e23b9';

const run = (command, arguments_, options = {}) =>
  spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
    ...options,
  });

const assertSuccess = (result, label) => {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
};

test('M0-010 exposes migration integrity, dry-run and focused-test entrypoints', async () => {
  const rootPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  );
  const documentation = await readFile(
    path.join(
      repositoryRoot,
      'docs',
      'architecture',
      'PRISMA_MIGRATION_REHEARSAL.md',
    ),
    'utf8',
  );

  assert.match(
    rootPackage.scripts['prisma:migrations:check'],
    /check-prisma-migrations\.mjs/u,
  );
  assert.match(
    rootPackage.scripts['prisma:migrate:dry-run'],
    /prisma-migration-rehearsal\.mjs/u,
  );
  assert.match(rootPackage.scripts['test:migrations'], /tests\/migrations/u);
  assert.match(
    rootPackage.scripts['test:migrations:clean-install'],
    /prisma-migration-clean-install\.ps1/u,
  );
  assert.match(rootPackage.scripts.test, /test:migrations/u);

  assert.match(documentation, /空库/u);
  assert.match(documentation, /升级路径/u);
  assert.match(documentation, /备份.*恢复/su);
  assert.match(documentation, /向前修复/u);
  assert.match(documentation, /生产迁移.*授权人工/su);
  assert.match(documentation, /不得.*编辑.*已发布迁移/su);
});

test('M0-010 does not introduce product models or placeholder SQL migrations', async () => {
  const schema = run('git', [
    'show',
    `${m0010Commit}:packages/db/prisma/schema.prisma`,
  ]).stdout;
  const migrationTree = run('git', [
    'ls-tree',
    '-r',
    '--name-only',
    m0010Commit,
    '--',
    'packages/db/prisma/migrations',
  ]);
  assertSuccess(migrationTree, 'read M0-010 migration snapshot');
  const sqlFiles = migrationTree.stdout
    .split(/\r?\n/u)
    .filter((filePath) => filePath.endsWith('.sql'));

  assert.doesNotMatch(schema, /^model\s+/mu);
  assert.deepEqual(sqlFiles, []);
});

test('published migration SQL is immutable while a new forward migration is allowed', async (t) => {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), 'fulishe-migration-integrity-'),
  );
  t.after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const publishedDirectory = path.join(
    fixtureRoot,
    'packages',
    'db',
    'prisma',
    'migrations',
    '20260802000000_initial',
  );
  await mkdir(publishedDirectory, { recursive: true });
  const publishedPath = path.join(publishedDirectory, 'migration.sql');
  const originalSql = 'CREATE TABLE `published_probe` (`id` INTEGER NOT NULL);\n';
  await writeFile(publishedPath, originalSql, 'utf8');

  for (const arguments_ of [
    ['init'],
    ['config', 'user.email', 'm0-010@example.invalid'],
    ['config', 'user.name', 'M0-010 Contract'],
    ['add', 'packages/db/prisma/migrations'],
    ['commit', '-m', 'publish initial migration'],
  ]) {
    assertSuccess(run('git', arguments_, { cwd: fixtureRoot }), `git ${arguments_.join(' ')}`);
  }

  const clean = run('node', [
    checkerPath,
    '--root',
    fixtureRoot,
    '--base-ref',
    'HEAD',
  ]);
  assertSuccess(clean, 'clean migration integrity check');

  await writeFile(
    publishedPath,
    'CREATE TABLE `published_probe` (`id` BIGINT NOT NULL);\n',
    'utf8',
  );
  const edited = run('node', [
    checkerPath,
    '--root',
    fixtureRoot,
    '--base-ref',
    'HEAD',
  ]);
  assert.notEqual(edited.status, 0);
  assert.match(
    `${edited.stdout}\n${edited.stderr}`,
    /PUBLISHED_MIGRATION_IMMUTABLE/u,
  );

  await writeFile(publishedPath, originalSql, 'utf8');
  await rm(publishedDirectory, { recursive: true, force: true });
  const deleted = run('node', [
    checkerPath,
    '--root',
    fixtureRoot,
    '--base-ref',
    'HEAD',
  ]);
  assert.notEqual(deleted.status, 0);
  assert.match(
    `${deleted.stdout}\n${deleted.stderr}`,
    /PUBLISHED_MIGRATION_IMMUTABLE/u,
  );

  await mkdir(publishedDirectory, { recursive: true });
  await writeFile(publishedPath, originalSql, 'utf8');
  const renamedDirectory = path.join(
    path.dirname(publishedDirectory),
    '20260802000001_renamed_history',
  );
  await rename(publishedDirectory, renamedDirectory);
  const renamed = run('node', [
    checkerPath,
    '--root',
    fixtureRoot,
    '--base-ref',
    'HEAD',
  ]);
  assert.notEqual(renamed.status, 0);
  assert.match(
    `${renamed.stdout}\n${renamed.stderr}`,
    /PUBLISHED_MIGRATION_IMMUTABLE/u,
  );
  await rename(renamedDirectory, publishedDirectory);

  const forwardDirectory = path.join(
    fixtureRoot,
    'packages',
    'db',
    'prisma',
    'migrations',
    '20260802000100_forward_fix',
  );
  await mkdir(forwardDirectory, { recursive: true });
  await writeFile(
    path.join(forwardDirectory, 'migration.sql'),
    'ALTER TABLE `published_probe` ADD COLUMN `marker` VARCHAR(32) NULL;\n',
    'utf8',
  );

  const forward = run('node', [
    checkerPath,
    '--root',
    fixtureRoot,
    '--base-ref',
    'HEAD',
  ]);
  assertSuccess(forward, 'new forward migration integrity check');
});
