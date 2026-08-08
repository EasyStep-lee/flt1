import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { InMemorySensitiveApprovalRepository } from '../../dist/sensitive-approval/in-memory-sensitive-approval.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const supplierId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const applicantIdentityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const reviewerIdentityId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const applicantAccountId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const reviewerAccountId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const companyAuditActor = (overrides = {}) => ({
  ownerType: 'COMPANY',
  accountTypeCode: 'COMPANY_AUDIT',
  companyId,
  functionalAccountId: applicantAccountId,
  identityType: 'COMPANY_USER',
  identityId: applicantIdentityId,
  supplierId: null,
  workspaceRoute: '/company-admin/workspaces/audit',
  permissionCodes: ['audit_event.read', 'sensitive_export.request', 'sensitive_export.review'],
  ...overrides,
});

const supplierAuditActor = (scopeSupplierId = supplierId) => ({
  ownerType: 'SUPPLIER',
  accountTypeCode: 'SUPPLIER_AUDIT',
  companyId: null,
  functionalAccountId: applicantAccountId,
  identityType: 'SUPPLIER_USER',
  identityId: applicantIdentityId,
  supplierId: scopeSupplierId,
  workspaceRoute: '/supplier/workspaces/audit',
  permissionCodes: ['audit_event.read', 'sensitive_export.request'],
});

const createFixture = async ({ failAudit = false, delayAudit = false } = {}) => {
  const actorRef = { current: companyAuditActor() };
  const storedAuditRepository = new InMemoryAuditLogRepository({
    failAppend: failAudit,
  });
  const auditRepository = delayAudit
    ? {
        append: async (command) => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return storedAuditRepository.append(command);
        },
        query: (query) => storedAuditRepository.query(query),
      }
    : storedAuditRepository;
  const sensitiveApprovalRepository = new InMemorySensitiveApprovalRepository(
    auditRepository,
  );
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditActorResolver: { resolve: async () => actorRef.current },
    auditLogRepository: auditRepository,
    sensitiveApprovalRepository,
    companySecondVerifier: { verify: async ({ code }) => code === '654321' },
    logger: false,
  });
  await app.init();
  return { actorRef, app, auditRepository };
};

const createApproval = (app, key = 'sensitive-export-create-0001') =>
  request(app.getHttpServer())
    .post('/v1/audit/sensitive-export-approvals')
    .set('Idempotency-Key', key)
    .set('x-request-id', randomUUID())
    .send({ reason: '季度权限审计复核', resource: 'AUDIT_EVENTS' });

describe('P0-072 sensitive operation approval API', () => {
  it('creates and replays one server-scoped sensitive export approval without exposing ownership keys', async () => {
    const fixture = await createFixture();
    try {
      const created = await createApproval(fixture.app);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        approvalType: 'SENSITIVE_EXPORT',
        resource: 'AUDIT_EVENTS',
        status: 'PENDING',
        version: 0,
      });
      expect(JSON.stringify(created.body)).not.toMatch(
        /applicantId|reviewedBy|functionalAccountId|supplierId|companyId|supplyPrice|bankAccount/iu,
      );
      const replay = await createApproval(fixture.app);
      expect(replay.status).toBe(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.id).toBe(created.body.id);
    } finally {
      await fixture.app.close();
    }
  });

  it('coalesces concurrent creates with the same idempotency key into one approval task', async () => {
    const fixture = await createFixture({ delayAudit: true });
    try {
      const [left, right] = await Promise.all([
        createApproval(fixture.app, 'concurrent-create-same-key-0001'),
        createApproval(fixture.app, 'concurrent-create-same-key-0001'),
      ]);
      expect([left.status, right.status]).toEqual([201, 201]);
      expect(left.body.id).toBe(right.body.id);
      expect(
        [left, right].filter(
          ({ headers }) => headers['idempotency-replayed'] === 'true',
        ),
      ).toHaveLength(1);
      const listed = await request(fixture.app.getHttpServer()).get(
        '/v1/audit/sensitive-export-approvals',
      );
      expect(listed.body).toMatchObject({ total: 1 });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-072-01 rejects the same natural person through another account without changing state', async () => {
    const fixture = await createFixture();
    try {
      const created = await createApproval(fixture.app);
      fixture.actorRef.current = companyAuditActor({
        functionalAccountId: reviewerAccountId,
      });
      const denied = await request(fixture.app.getHttpServer())
        .post(`/v1/audit/sensitive-export-approvals/${created.body.id}/claim`)
        .set('Idempotency-Key', 'same-person-claim-0001')
        .set('x-request-id', randomUUID())
        .send({ version: 0 });
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'SAME_NATURAL_PERSON_REVIEW' });
      const list = await request(fixture.app.getHttpServer()).get(
        '/v1/audit/sensitive-export-approvals',
      );
      expect(list.body.items[0]).toMatchObject({ status: 'PENDING', version: 0 });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-072-02 denies a super administrator bypass before review mutation', async () => {
    const fixture = await createFixture();
    try {
      const created = await createApproval(fixture.app);
      fixture.actorRef.current = companyAuditActor({
        accountTypeCode: 'COMPANY_SUPER_ADMIN',
        functionalAccountId: reviewerAccountId,
        identityId: reviewerIdentityId,
        permissionCodes: ['sensitive_export.review'],
        workspaceRoute: '/company-admin/workspaces/system',
      });
      const denied = await request(fixture.app.getHttpServer())
        .post(`/v1/audit/sensitive-export-approvals/${created.body.id}/claim`)
        .set('Idempotency-Key', 'super-admin-claim-0001')
        .set('x-request-id', randomUUID())
        .send({ version: 0 });
      expect(denied.status).toBe(428);
      expect(denied.body).toMatchObject({ code: 'SECOND_REVIEW_REQUIRED' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-072-03 permits exactly one decision for one optimistic version', async () => {
    const fixture = await createFixture();
    try {
      const created = await createApproval(fixture.app);
      fixture.actorRef.current = companyAuditActor({
        functionalAccountId: reviewerAccountId,
        identityId: reviewerIdentityId,
      });
      const claimed = await request(fixture.app.getHttpServer())
        .post(`/v1/audit/sensitive-export-approvals/${created.body.id}/claim`)
        .set('Idempotency-Key', 'claim-reviewer-0001')
        .set('x-request-id', randomUUID())
        .send({ version: 0 });
      expect(claimed.status).toBe(200);
      const decide = (key) =>
        request(fixture.app.getHttpServer())
          .post(`/v1/audit/sensitive-export-approvals/${created.body.id}/decision`)
          .set('Idempotency-Key', key)
          .set('x-request-id', randomUUID())
          .send({
            decision: 'APPROVE',
            opinion: '复核通过',
            secondVerificationCode: '654321',
            version: 1,
          });
      const responses = await Promise.all([
        decide('decision-concurrent-a-0001'),
        decide('decision-concurrent-b-0001'),
      ]);
      expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
      expect(responses.find(({ status }) => status === 409)?.body).toMatchObject({
        code: 'APPROVAL_VERSION_CONFLICT',
      });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-072-04 rejects the operation when mandatory audit persistence fails', async () => {
    const fixture = await createFixture({ failAudit: true });
    try {
      const denied = await createApproval(fixture.app, 'audit-failure-create-0001');
      expect(denied.status).toBe(503);
      expect(denied.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
    } finally {
      await fixture.app.close();
    }
  });

  it('scopes supplier approval lists before lookup and denies supplier review actions', async () => {
    const fixture = await createFixture();
    try {
      fixture.actorRef.current = supplierAuditActor();
      const created = await createApproval(fixture.app, 'supplier-create-approval-0001');
      expect(created.status).toBe(201);
      fixture.actorRef.current = supplierAuditActor(
        '99999999-9999-4999-8999-999999999999',
      );
      const otherSupplier = await request(fixture.app.getHttpServer()).get(
        '/v1/audit/sensitive-export-approvals',
      );
      expect(otherSupplier.status).toBe(200);
      expect(otherSupplier.body).toMatchObject({ items: [], total: 0 });
      const denied = await request(fixture.app.getHttpServer())
        .post(`/v1/audit/sensitive-export-approvals/${created.body.id}/claim`)
        .set('Idempotency-Key', 'supplier-review-denied-0001')
        .set('x-request-id', randomUUID())
        .send({ version: 0 });
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });
});
