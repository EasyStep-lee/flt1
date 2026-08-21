import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('M3-P073 freezes public and private portal navigation without inventing login or legal approval', async () => {
  const [content, components, privateLayout, serviceAgreement, privacyPolicy] = await Promise.all([
    read('apps/portal-web/src/public-content.ts'),
    read('apps/portal-web/src/public-components.tsx'),
    read('apps/portal-web/src/app/(private)/layout.tsx'),
    read('apps/portal-web/src/app/(public)/legal/service-agreement/page.tsx'),
    read('apps/portal-web/src/app/(public)/legal/privacy-policy/page.tsx'),
  ]);

  for (const [label, href] of [
    ['首页', '/'],
    ['关于福礼团', '/about'],
    ['供应链能力', '/capabilities'],
    ['社区集采', '/enterprise-procurement'],
    ['福利卡', '/contact#enterprise-welfare'],
    ['供应商合作', '/supplier-cooperation'],
    ['新闻公告', '/news'],
    ['联系我们', '/contact'],
  ]) {
    assert.match(content, new RegExp(`href: '${href.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}'.*label: '${label}'`, 'u'));
  }
  assert.match(components, /data-testid="public-enterprise-actions"/u);
  assert.match(components, /href="\/enterprise\/register"/u);
  assert.match(components, /href="\/enterprise\/login"/u);
  assert.match(components, /江苏福礼团供应链科技有限公司|COMPANY_LEGAL_NAME/u);
  assert.match(components, /平台服务协议/u);
  assert.match(components, /隐私政策/u);

  assert.match(privateLayout, /aria-label="企业采购导航"/u);
  assert.match(privateLayout, /\/enterprise\/procurement\/products/u);
  assert.match(privateLayout, /\/enterprise\/procurement\/cart/u);
  assert.match(privateLayout, /\/enterprise\/workspace/u);
  assert.match(privateLayout, /index: false/u);

  assert.match(serviceAgreement, /data-legal-status="NOT_EXECUTED"/u);
  assert.match(privacyPolicy, /data-legal-status="NOT_EXECUTED"/u);
  assert.doesNotMatch(`${serviceAgreement}\n${privacyPolicy}`, /已通过法务审核|正式生效/u);
});

test('M3-P073 evidence advances only this task and keeps P074 locked', async () => {
  const [stateSource, freezeSource, artifactSource] = await Promise.all([
    read('福礼社Codex5.6开发执行包V1.1/16-项目状态.json'),
    read('artifacts/verification/M3-000/m3-contract-freeze.json'),
    read('artifacts/verification/M3-P073/portal-navigation.json'),
  ]);
  const state = JSON.parse(stateSource);
  const freeze = JSON.parse(freezeSource);
  const artifact = JSON.parse(artifactSource);

  assert.equal(state.execution.currentTask, 'M3-P073');
  assert.equal(state.execution.nextAllowedTask, 'M3-P073');
  assert.equal(state.execution.lastCompletedTask, 'M3-P062');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P073');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P073.*M3-P074/u);
  assert.equal(artifact.taskId, 'M3-P073');
  assert.equal(artifact.boundaries.migration, 'NONE');
  assert.equal(artifact.boundaries.openapi, 'NONE');
  assert.equal(artifact.boundaries.legalTextApproval, 'NOT_EXECUTED');

  const p062 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P062');
  const p073 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P073');
  const p074 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P074');
  assert.equal(p062.every(({ executionStatus }) => executionStatus === 'CI_PASS'), true);
  assert.equal(p073.every(({ executionStatus }) => ['LOCAL_PASS', 'CI_PASS'].includes(executionStatus)), true);
  assert.equal(p074.every(({ executionStatus }) => executionStatus === 'NOT_EXECUTED'), true);
});
