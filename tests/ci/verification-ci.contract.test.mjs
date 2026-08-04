import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const readRepositoryFile = (relativePath) =>
  readFile(path.join(repositoryRoot, ...relativePath.split('/')), 'utf8');
const importRepositoryModule = (relativePath) =>
  import(pathToFileURL(path.join(repositoryRoot, ...relativePath.split('/'))).href);

test('root scripts expose the complete verification gate without a silent bypass', async () => {
  const packageJson = JSON.parse(await readRepositoryFile('package.json'));

  assert.equal(
    packageJson.scripts.verify,
    'node ./scripts/run-verification.mjs',
  );
  assert.equal(
    packageJson.scripts['test:ci'],
    'node --test ./tests/ci/*.test.mjs',
  );
  assert.equal(
    packageJson.scripts['test:ci:clean-install'],
    'pwsh -NoProfile -File ./tests/ci/ci-gate-clean-install.ps1',
  );
  assert.equal(
    packageJson.scripts['test:e2e:p0'],
    'node ./scripts/run-p0-e2e-gate.mjs',
  );
  assert.equal(
    packageJson.scripts['openapi:diff'],
    'git diff --exit-code HEAD -- packages/contracts/openapi.json packages/contracts/types.ts',
  );
  assert.doesNotMatch(packageJson.scripts.verify, /--if-present|\|\|\s*true|--no-verify/u);
});

test('clean-install rehearsal uses a full-history checkout, frozen install, and the full gate', async () => {
  const script = await readRepositoryFile(
    'tests/ci/ci-gate-clean-install.ps1',
  );
  assert.match(
    script,
    /git clone --quiet --no-hardlinks --no-checkout -- \$repoRoot \$tempRoot/u,
  );
  assert.match(
    script,
    /git -C \$tempRoot checkout --quiet --detach \$sourceSha/u,
  );
  assert.match(
    script,
    /pnpm install --frozen-lockfile --ignore-scripts --prefer-offline/u,
  );
  assert.match(script, /pnpm verify -- --base-ref \$baseSha/u);
  assert.match(script, /fulishe-m0-011-/u);
  assert.match(script, /干净安装测试改变了原仓库工作树/u);
  assert.doesNotMatch(
    script,
    /Copy-CiGateFile|git init --quiet|git add -- \.|git commit --quiet|--depth|git add -A|git reset --hard|--no-verify/u,
  );
});

test('verification plan is complete, ordered, immutable-base aware, and rejects skip controls', async () => {
  const {
    assertNoVerificationBypass,
    resolveVerificationBaseRef,
    verificationSteps,
  } = await importRepositoryModule('scripts/verification-plan.mjs');

  assert.deepEqual(
    verificationSteps.map(({ id }) => id),
    [
      'workspace',
      'lint',
      'openapi-generate',
      'openapi-diff',
      'openapi-check',
      'openapi-breaking',
      'typecheck',
      'unit',
      'regression',
      'api',
      'e2e-foundation',
      'e2e-p0',
      'prisma-validate',
      'migration-integrity',
      'migration-rehearsal',
      'build',
      'secrets',
    ],
  );

  assert.throws(
    () => resolveVerificationBaseRef({ argv: [], env: { CI: 'true' } }),
    /VERIFY_BASE_REF_REQUIRED_IN_CI/u,
  );
  assert.deepEqual(resolveVerificationBaseRef({ argv: [], env: {} }), {
    value: 'HEAD',
    source: 'LOCAL_HEAD_FALLBACK',
  });

  const immutableSha = 'a'.repeat(40);
  assert.deepEqual(
    resolveVerificationBaseRef({
      argv: [],
      env: { CI: 'true', VERIFY_BASE_REF: immutableSha },
    }),
    { value: immutableSha, source: 'ENVIRONMENT' },
  );
  assert.throws(
    () =>
      assertNoVerificationBypass({
        VERIFY_SKIP_LINT: '1',
      }),
    /VERIFY_BYPASS_FORBIDDEN:VERIFY_SKIP_LINT/u,
  );
});

test('GitHub CI uses frozen installation, full history, immutable action pins, and a real event base', async () => {
  const workflow = await readRepositoryFile('.github/workflows/ci.yml');

  assert.match(workflow, /pull_request:/u);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main\]/u);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/u);
  assert.match(workflow, /fetch-depth:\s*0/u);
  assert.match(workflow, /persist-credentials:\s*false/u);
  assert.match(workflow, /pnpm install --frozen-lockfile --ignore-scripts/u);
  assert.match(workflow, /playwright install --with-deps chromium/u);
  assert.match(workflow, /node \.\/scripts\/resolve-ci-base\.mjs/u);
  assert.match(workflow, /VERIFY_BASE_REF:\s*\$\{\{ steps\.base\.outputs\.sha \}\}/u);
  assert.match(workflow, /run:\s*pnpm verify/u);

  const expectedPins = new Map([
    ['actions/checkout', '11d5960a326750d5838078e36cf38b85af677262'],
    ['actions/setup-node', '49933ea5288caeca8642d1e84afbd3f7d6820020'],
    ['pnpm/action-setup', 'b906affcce14559ad1aafd4ab0e942779e9f58b1'],
    ['actions/upload-artifact', 'ea165f8d65b6e75b540449e92b4886f43607fa02'],
  ]);
  const actionLines = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@([^\s#]+)/gmu)];
  assert.equal(actionLines.length, expectedPins.size);
  for (const [, repository, revision] of actionLines) {
    assert.equal(revision, expectedPins.get(repository));
    assert.match(revision, /^[0-9a-f]{40}$/u);
  }

  assert.doesNotMatch(
    workflow,
    /continue-on-error|\|\|\s*true|if:\s*false|--no-verify|pull_request_target|write-all|contents:\s*write/u,
  );
});

test('CI base selection uses immutable event SHAs and rejects an uncomparable initial push', async () => {
  const { selectCiBaseCandidate } = await importRepositoryModule(
    'scripts/resolve-ci-base.mjs',
  );
  const pullRequestSha = '1'.repeat(40);
  const pushBeforeSha = '2'.repeat(40);

  assert.equal(
    selectCiBaseCandidate({
      eventName: 'pull_request',
      pullRequestBaseSha: pullRequestSha,
      pushBeforeSha: '',
    }),
    pullRequestSha,
  );
  assert.equal(
    selectCiBaseCandidate({
      eventName: 'push',
      pullRequestBaseSha: '',
      pushBeforeSha,
    }),
    pushBeforeSha,
  );
  assert.throws(
    () =>
      selectCiBaseCandidate({
        eventName: 'push',
        pullRequestBaseSha: '',
        pushBeforeSha: '0'.repeat(40),
      }),
    /CI_BASE_REF_INITIAL_PUSH_UNSUPPORTED/u,
  );
});

test('P0 E2E gate runs the available business P0 after contract freeze', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'scripts', 'run-p0-e2e-gate.mjs')],
    { cwd: repositoryRoot, encoding: 'utf8', env: process.env },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /p0-001-single-merchant\.spec\.ts/u,
  );
  assert.match(result.stdout, /P0-001 portal identifies the company/u);
  assert.match(result.stdout, /\d+ passed/u);
  assert.doesNotMatch(
    result.stdout,
    /P0_E2E_NOT_APPLICABLE|passWithNoTests|skipped successfully/iu,
  );
});

test('GitHub collaboration templates and formal ownership require real accountable identities', async () => {
  const [pullRequestTemplate, codeowners, dependabot, featureIssue, bugIssue] =
    await Promise.all([
      readRepositoryFile('.github/pull_request_template.md'),
      readRepositoryFile('.github/CODEOWNERS'),
      readRepositoryFile('.github/dependabot.yml'),
      readRepositoryFile('.github/ISSUE_TEMPLATE/feature.yml'),
      readRepositoryFile('.github/ISSUE_TEMPLATE/bug.yml'),
    ]);

  for (const required of [
    '范围',
    '明确不实现',
    'P0',
    'pnpm verify',
    '迁移',
    'OpenAPI',
    '风险与回滚',
    'BLOCKED_EXTERNAL',
  ]) {
    assert.match(pullRequestTemplate, new RegExp(required, 'u'));
  }
  for (const protectedPath of [
    '*',
    '/packages/db/prisma/migrations/',
    '/apps/api/src/modules/payments/',
    '/apps/api/src/modules/welfare-card/',
    '/apps/api/src/modules/permissions/',
    '/apps/api/src/modules/delivery/',
    '/.github/',
  ]) {
    assert.match(
      codeowners,
      new RegExp(`^${protectedPath.replaceAll('/', '\\/').replace('*', '\\*')}\\s+@EasyStep-lee$`, 'mu'),
    );
  }
  assert.doesNotMatch(
    codeowners,
    /@(OWNER|DB_OWNER|FINANCE_OWNER|SECURITY_OWNER|LOGISTICS_OWNER|REPO_ADMIN)\b/u,
  );
  await assert.rejects(
    readRepositoryFile('.github/CODEOWNERS.example'),
    (error) => error?.code === 'ENOENT',
  );
  assert.match(dependabot, /package-ecosystem:\s*["']npm["']/u);
  assert.match(dependabot, /package-ecosystem:\s*["']github-actions["']/u);
  assert.doesNotMatch(dependabot, /target-branch:/u);
  assert.match(featureIssue, /失败测试与完成定义/u);
  assert.match(bugIssue, /已移除Token、密钥、证书/u);
});
