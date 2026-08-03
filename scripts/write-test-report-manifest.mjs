import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const reportRoot = path.join(repositoryRoot, 'artifacts', 'test-results');
const manifestPath = path.join(reportRoot, 'manifest.json');
const expectedReports = [
  'vitest/results.json',
  'vitest/junit.xml',
  'playwright/results.json',
  'playwright/junit.xml',
  'playwright/html/index.html',
];

const toPortablePath = (value) => value.split(path.sep).join('/');

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath)));
    if (entry.isFile()) files.push(absolutePath);
  }
  return files;
};

const gitOutput = async (arguments_) => {
  const { stdout } = await execFileAsync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return stdout.trim();
};

await mkdir(reportRoot, { recursive: true });
for (const relativePath of expectedReports) {
  const reportPath = path.join(reportRoot, ...relativePath.split('/'));
  const reportStat = await stat(reportPath);
  if (!reportStat.isFile() || reportStat.size === 0) {
    throw new Error(`TEST_REPORT_MISSING_OR_EMPTY:${relativePath}`);
  }
}

const files = (await listFiles(reportRoot))
  .filter((filePath) => filePath !== manifestPath)
  .sort((left, right) => left.localeCompare(right));
const entries = await Promise.all(
  files.map(async (filePath) => {
    const contents = await readFile(filePath);
    return {
      path: toPortablePath(path.relative(reportRoot, filePath)),
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  }),
);

const trackedChanges = await gitOutput(['status', '--short', '--untracked-files=no']);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  git: {
    commit: await gitOutput(['rev-parse', 'HEAD']),
    trackedWorktreeClean: trackedChanges.length === 0,
  },
  runtime: {
    node: process.version,
  },
  reports: entries,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `TEST_REPORT_MANIFEST_WRITTEN:${toPortablePath(path.relative(repositoryRoot, manifestPath))}:${entries.length}`,
);
