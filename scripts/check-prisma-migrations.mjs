import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDirectoryPattern = /^\d{14}_[a-z0-9][a-z0-9_]*$/u;
const migrationRootRelative = 'packages/db/prisma/migrations';

const toPortablePath = (value) => value.split(path.sep).join('/');

const runGit = (repositoryRoot, arguments_) => {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `MIGRATION_GIT_COMMAND_FAILED:${arguments_.join(' ')}\n${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
};

const readCurrentMigrations = async (repositoryRoot) => {
  const migrationRoot = path.join(
    repositoryRoot,
    ...migrationRootRelative.split('/'),
  );
  const rootStat = await stat(migrationRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`MIGRATION_DIRECTORY_MISSING:${migrationRootRelative}`);
  }

  const entries = await readdir(migrationRoot, { withFileTypes: true });
  const migrations = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (entry.isFile() && entry.name === 'README.md') continue;
    if (!entry.isDirectory()) {
      throw new Error(
        `MIGRATION_DIRECTORY_UNEXPECTED_ENTRY:${migrationRootRelative}/${entry.name}`,
      );
    }
    if (!migrationDirectoryPattern.test(entry.name)) {
      throw new Error(`MIGRATION_DIRECTORY_NAME_INVALID:${entry.name}`);
    }

    const directoryPath = path.join(migrationRoot, entry.name);
    const directoryEntries = await readdir(directoryPath, {
      withFileTypes: true,
    });
    if (
      directoryEntries.length !== 1 ||
      !directoryEntries[0].isFile() ||
      directoryEntries[0].name !== 'migration.sql'
    ) {
      throw new Error(
        `MIGRATION_DIRECTORY_CONTENT_INVALID:${entry.name}:expected migration.sql only`,
      );
    }

    const sql = await readFile(
      path.join(directoryPath, 'migration.sql'),
      'utf8',
    );
    if (sql.trim().length === 0) {
      throw new Error(`MIGRATION_SQL_EMPTY:${entry.name}/migration.sql`);
    }
    migrations.push({
      name: entry.name,
      path: `${migrationRootRelative}/${entry.name}/migration.sql`,
      sha256: createHash('sha256').update(sql).digest('hex'),
    });
  }
  return migrations;
};

const parseNameStatus = (output) =>
  output
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { status, paths };
    });

export const inspectMigrationIntegrity = async ({
  repositoryRoot = process.cwd(),
  baseRef = process.env.PRISMA_MIGRATION_BASE_REF ?? 'HEAD',
} = {}) => {
  const resolvedRoot = path.resolve(repositoryRoot);
  runGit(resolvedRoot, ['rev-parse', '--verify', `${baseRef}^{commit}`]);

  const migrations = await readCurrentMigrations(resolvedRoot);
  const publishedPaths = new Set(
    runGit(resolvedRoot, [
      'ls-tree',
      '-r',
      '--name-only',
      baseRef,
      '--',
      migrationRootRelative,
    ])
      .split(/\r?\n/u)
      .filter((entry) => entry.endsWith('/migration.sql')),
  );
  const changes = parseNameStatus(
    runGit(resolvedRoot, [
      'diff',
      '--name-status',
      '--find-renames',
      baseRef,
      '--',
      migrationRootRelative,
    ]),
  );

  const violations = [];
  for (const change of changes) {
    const kind = change.status[0];
    const affectedPublishedPaths = change.paths.filter((changedPath) =>
      publishedPaths.has(toPortablePath(changedPath)),
    );
    if (
      affectedPublishedPaths.length > 0 &&
      ['M', 'D', 'R', 'C', 'T', 'U'].includes(kind)
    ) {
      violations.push(
        ...affectedPublishedPaths.map(
          (changedPath) =>
            `PUBLISHED_MIGRATION_IMMUTABLE:${change.status}:${toPortablePath(changedPath)}`,
        ),
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }

  return {
    schemaVersion: 1,
    baseRef,
    publishedMigrationCount: publishedPaths.size,
    currentMigrationCount: migrations.length,
    migrations,
  };
};

const parseArguments = (arguments_) => {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--root') {
      options.repositoryRoot = arguments_[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--base-ref') {
      options.baseRef = arguments_[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`MIGRATION_CHECK_ARGUMENT_UNSUPPORTED:${argument}`);
  }
  if (options.repositoryRoot === '') {
    throw new Error('MIGRATION_CHECK_ROOT_MISSING');
  }
  if (options.baseRef === '') {
    throw new Error('MIGRATION_CHECK_BASE_REF_MISSING');
  }
  return options;
};

const modulePath = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(modulePath);

if (isMain) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = await inspectMigrationIntegrity(options);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `PRISMA_MIGRATIONS_OK:base=${report.baseRef}:published=${report.publishedMigrationCount}:current=${report.currentMigrationCount}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
