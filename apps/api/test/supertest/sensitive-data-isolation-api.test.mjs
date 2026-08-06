import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

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

class CountingAuditLogRepository extends InMemoryAuditLogRepository {
  listCalls = 0;

  async list(query) {
    this.listCalls += 1;
    return super.list(query);
  }
}

const createFixture = async () => {
  const repository = new CountingAuditLogRepository();
  const actorRef = {
    current: {
      accountTypeCode: 'COMPANY_AUDIT',
      companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      functionalAccountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      identityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspaceRoute: '/company-admin/workspaces/audit',
    },
  };
  await repository.append({
    actorType: 'SUPPLIER_USER',
    actorId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    action: 'fixture.changed',
    objectType: 'fixture',
    objectId: 'fixture-001',
    beforeSnapshot: { salePrice: 1299, supplyPrice: 899 },
    afterSnapshot: {
      supplierPayableAmount: 700,
      nested: { grossMargin: 400, title: '保留字段' },
    },
    requestId: '11111111-1111-4111-8111-111111111111',
    ip: '127.0.0.1',
  });
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: repository,
    auditActorResolver: { resolve: async () => actorRef.current },
    logger: false,
  });
  await app.init();
  return { actorRef, app, repository };
};

describe('P0-046 sensitive data isolation at the API boundary', () => {
  it('NEG-M1-046-03 omits restricted fields recursively from an internal audit DTO', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer()).get('/v1/audit/events');
      expect(response.status).toBe(200);
      expect(response.body.items[0]).toMatchObject({
        beforeSnapshot: { salePrice: 1299 },
        afterSnapshot: { nested: { title: '保留字段' } },
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /supplyPrice|approvedSupplyPrice|supplierPayable|grossMargin/u,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-046-01 and 04 reject field escalation and export before lookup', async () => {
    const fixture = await createFixture();
    try {
      for (const [query, code] of [
        ['fieldGroup=SUPPLY_PRICE', 'FIELD_FORBIDDEN'],
        ['export=1', 'EXPORT_APPROVAL_REQUIRED'],
      ]) {
        const response = await request(fixture.app.getHttpServer()).get(
          `/v1/audit/events?${query}`,
        );
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code });
        expect(response.headers['content-disposition']).toBeUndefined();
      }
      expect(fixture.repository.listCalls).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-046-02 rejects a valid account on a different workspace before lookup', async () => {
    const fixture = await createFixture();
    try {
      fixture.actorRef.current = {
        ...fixture.actorRef.current,
        accountTypeCode: 'COMPANY_FINANCE',
        workspaceRoute: '/company-admin/workspaces/finance',
      };
      const response = await request(fixture.app.getHttpServer()).get('/v1/audit/events');
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(fixture.repository.listCalls).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });
});
