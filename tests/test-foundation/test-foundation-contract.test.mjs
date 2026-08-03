import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const readRepositoryFile = async (relativePath) =>
  await readFile(path.join(repositoryRoot, relativePath), 'utf8');

const readJson = async (relativePath) =>
  JSON.parse(await readRepositoryFile(relativePath));

test('M0-009 exposes the locked test-pyramid entrypoints and versions', async () => {
  const rootPackage = await readJson('package.json');
  const apiPackage = await readJson('apps/api/package.json');
  const testKitPackage = await readJson('packages/test-kit/package.json');

  assert.equal(rootPackage.devDependencies.vitest, '4.1.10');
  assert.equal(rootPackage.devDependencies['@playwright/test'], '1.62.1');
  assert.match(rootPackage.scripts['test:unit'], /--project unit/u);
  assert.match(rootPackage.scripts['test:api:supertest'], /--project api-contract/u);
  assert.match(rootPackage.scripts['test:e2e:foundation'], /playwright test/u);
  assert.match(rootPackage.scripts['test:reports'], /write-test-report-manifest/u);

  assert.equal(apiPackage.devDependencies.supertest, '7.2.2');
  assert.equal(apiPackage.devDependencies['@types/supertest'], '7.2.1');
  assert.match(apiPackage.scripts.test, /vitest run --root \.\.\/\.\./u);
  assert.equal(testKitPackage.name, '@fulishe/test-kit');
  assert.equal(testKitPackage.devDependencies.vitest, '4.1.10');
  assert.match(testKitPackage.scripts.test, /vitest run --root \.\.\/\.\./u);
});

test('M0-009 keeps unit, API-contract and browser tests in separate projects', async () => {
  const vitestConfig = await readRepositoryFile('vitest.config.ts');
  const reportConfig = await readRepositoryFile('vitest.report.config.ts');
  const playwrightConfig = await readRepositoryFile('playwright.config.ts');

  assert.match(vitestConfig, /name:\s*['"]unit['"]/u);
  assert.match(vitestConfig, /name:\s*['"]api-contract['"]/u);
  assert.match(vitestConfig, /packages\/test-kit\/test/u);
  assert.match(vitestConfig, /apps\/api\/test\/supertest/u);

  for (const reporter of ['default', 'json', 'junit']) {
    assert.match(reportConfig, new RegExp(`['"]${reporter}['"]`, 'u'));
  }
  assert.match(reportConfig, /artifacts\/test-results\/vitest/u);

  assert.match(playwrightConfig, /name:\s*['"]chromium['"]/u);
  assert.match(playwrightConfig, /webServer/u);
  assert.match(playwrightConfig, /reporters?|reporter/u);
  assert.match(playwrightConfig, /artifacts\/test-results\/playwright/u);
});

test('M0-009 provides runner-neutral concurrency and idempotency probes', async () => {
  const testKitSource = await readRepositoryFile('packages/test-kit/src/index.ts');
  const testKitTests = await readRepositoryFile(
    'packages/test-kit/test/concurrency-idempotency.test.ts',
  );

  assert.match(testKitSource, /runConcurrently/u);
  assert.match(testKitSource, /requireExactlyOneFulfilled/u);
  assert.match(testKitSource, /verifyIdempotentReplay/u);
  assert.match(testKitTests, /exactly one concurrent attempt succeeds/u);
  assert.match(testKitTests, /same idempotency key replays/u);
});

test('M0-009 documents red-green evidence and archives machine-readable reports', async () => {
  const failureTemplate = await readRepositoryFile(
    'docs/testing/FAILURE_TEST_TEMPLATE.md',
  );
  const pyramid = await readRepositoryFile(
    'docs/architecture/TEST_PYRAMID.md',
  );
  const manifestWriter = await readRepositoryFile(
    'scripts/write-test-report-manifest.mjs',
  );
  const gitignore = await readRepositoryFile('.gitignore');

  assert.match(failureTemplate, /RED.*GREEN/is);
  assert.match(failureTemplate, /失败原因/u);
  assert.match(failureTemplate, /幂等/u);
  assert.match(failureTemplate, /并发/u);
  assert.match(pyramid, /Vitest/u);
  assert.match(pyramid, /Supertest/u);
  assert.match(pyramid, /Playwright/u);
  assert.match(manifestWriter, /sha256/u);
  assert.match(gitignore, /^artifacts\/test-results\/$/mu);
});
