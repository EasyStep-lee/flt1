import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierOnboardingRepository } from '../../dist/supplier-onboarding/in-memory-supplier-onboarding.repository.js';

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

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};

const registrationBody = (overrides = {}) => ({
  legalName: '南京示例供应链有限公司',
  creditCode: '91320100MA1ABC2D3X',
  contactName: '张经理',
  mobile: '13800138000',
  email: 'supplier@example.test',
  verificationCode: '123456',
  qualificationFiles: [],
  pickupAddress: '',
  pickupLat: null,
  pickupLng: null,
  agreementVersion: 'supplier-agreement-v1.1',
  ...overrides,
});

const createFixture = async () => {
  const repository = new InMemorySupplierOnboardingRepository([company]);
  const supplierIdRef = { current: undefined };
  const actorResolver = {
    resolve: async (_request, requiredRole) => {
      if (requiredRole === 'SUPPLIER_ACCOUNT_ADMIN') {
        if (!supplierIdRef.current) throw new Error('TEST_SUPPLIER_ID_NOT_BOUND');
        return {
          role: 'SUPPLIER_ACCOUNT_ADMIN',
          identityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          supplierId: supplierIdRef.current,
        };
      }
      return {
        role: 'COMPANY_SUPPLIER_OPS',
        companyId: company.id,
        identityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      };
    },
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    merchantRepository: {
      findCustomerFacingCompanies: async () => [company],
    },
    supplierOnboardingRepository: repository,
    supplierOnboardingActorResolver: actorResolver,
    supplierRegistrationVerifier: { verify: async () => undefined },
    logger: false,
  });
  await app.init();
  return { app, repository, supplierIdRef };
};

const createSafeDefaultFixture = async () => {
  const repository = new InMemorySupplierOnboardingRepository([company]);
  const app = await createApplication({
    config: config(),
    probes: probes(),
    merchantRepository: {
      findCustomerFacingCompanies: async () => [company],
    },
    supplierOnboardingRepository: repository,
    logger: false,
  });
  await app.init();
  return { app, repository };
};

const register = async (fixture, key, body = registrationBody()) => {
  const response = await request(fixture.app.getHttpServer())
    .post('/v1/suppliers/registrations')
    .set('Idempotency-Key', key)
    .send(body);
  if (response.status === 201) fixture.supplierIdRef.current = response.body.registrationId;
  return response;
};

describe('P0-003 supplier onboarding API', () => {
  it('defaults external verification and private functional sessions to deny', async () => {
    const fixture = await createSafeDefaultFixture();
    try {
      const registration = await request(fixture.app.getHttpServer())
        .post('/v1/suppliers/registrations')
        .set('Idempotency-Key', 'registration-safe-default-0001')
        .send(registrationBody());
      expect(registration.status).toBe(503);
      expect(registration.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(await fixture.repository.countSuppliers()).toBe(0);

      const privateMutation = await request(fixture.app.getHttpServer())
        .patch('/v1/supplier/me')
        .set('Idempotency-Key', 'patch-safe-default-0001')
        .set('x-supplier-id', 'client-controlled')
        .send({ version: 0, supplierId: 'client-controlled' });
      expect(privateMutation.status).toBe(401);
      expect(privateMutation.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    } finally {
      await fixture.app.close();
    }
  });

  it('rejects client-controlled ownership fields before creating a supplier', async () => {
    const fixture = await createFixture();
    try {
      const response = await register(
        fixture,
        'registration-owner-tamper-0001',
        registrationBody({ companyId: company.id, status: 'ACTIVE' }),
      );
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FIELD_FORBIDDEN' });
      expect(await fixture.repository.countSuppliers()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('creates an editable no-store draft using only the response whitelist', async () => {
    const fixture = await createFixture();
    try {
      const response = await register(fixture, 'registration-create-0001');

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body).toEqual({
        registrationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        status: 'DRAFT',
        nextAction: 'COMPLETE_PROFILE',
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /companyId|supplierId|verificationCode|mobile|email|qualificationFiles/iu,
      );
      expect(await fixture.repository.countSuppliers()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-003-03 replays the original registration for the same key and body', async () => {
    const fixture = await createFixture();
    try {
      const first = await register(fixture, 'registration-replay-0001');
      const replay = await register(fixture, 'registration-replay-0001');

      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(await fixture.repository.countSuppliers()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-003-01 rejects the same normalized credit code under a new key', async () => {
    const fixture = await createFixture();
    try {
      const first = await register(fixture, 'registration-duplicate-0001');
      expect(first.status).toBe(201);

      const duplicate = await register(
        fixture,
        'registration-duplicate-0002',
        registrationBody({ creditCode: ' 91320100ma1abc2d3x ' }),
      );
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'SUPPLIER_DUPLICATE' });
      expect(await fixture.repository.countSuppliers()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-003-04 keeps an incomplete draft editable after failed submission', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(fixture, 'registration-incomplete-0001');
      expect(created.status).toBe(201);

      const incomplete = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/me/submit-review')
        .set('Idempotency-Key', 'submit-incomplete-0001')
        .send({ version: 0, requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
      expect(incomplete.status).toBe(422);
      expect(incomplete.body).toMatchObject({ code: 'VALIDATION_FAILED' });

      const corrected = await request(fixture.app.getHttpServer())
        .patch('/v1/supplier/me')
        .set('Idempotency-Key', 'patch-incomplete-0001')
        .send({
          version: 0,
          pickupAddress: '南京市建邺区江东中路 100 号',
          pickupLat: 32.0415447,
          pickupLng: 118.7699941,
          qualificationSnapshot: {
            schemaVersion: '1.0',
            files: ['object://supplier-qualification/business-license-001'],
          },
        });
      expect(corrected.status).toBe(200);
      expect(corrected.body).toMatchObject({ status: 'DRAFT', version: 1 });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-003-02 rejects approving a DRAFT supplier without a pending task', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(
        fixture,
        'registration-direct-approve-0001',
        registrationBody({
          qualificationFiles: ['object://supplier-qualification/license-001'],
          pickupAddress: '南京市建邺区江东中路 100 号',
          pickupLat: 32.0415447,
          pickupLng: 118.7699941,
        }),
      );
      expect(created.status).toBe(201);

      const response = await request(fixture.app.getHttpServer())
        .post(`/v1/company/suppliers/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'review-direct-approve-0001')
        .send({ decision: 'APPROVE', version: 0, opinion: '资料审核通过' });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'STATE_TRANSITION_INVALID' });
      expect((await fixture.repository.getSupplier(created.body.registrationId)).status).toBe(
        'DRAFT',
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('moves through submit, correction, resubmit and activation with append-only versions', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(
        fixture,
        'registration-lifecycle-0001',
        registrationBody({
          qualificationFiles: ['object://supplier-qualification/license-001'],
          pickupAddress: '南京市建邺区江东中路 100 号',
          pickupLat: 32.0415447,
          pickupLng: 118.7699941,
        }),
      );
      expect(created.status).toBe(201);

      const submitted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/me/submit-review')
        .set('Idempotency-Key', 'submit-lifecycle-0001')
        .send({ version: 0, requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });
      expect(submitted.status).toBe(201);
      expect(submitted.body).toMatchObject({
        approvalType: 'SUPPLIER_ONBOARDING',
        status: 'PENDING',
        version: 1,
      });
      expect(JSON.stringify(submitted.body)).not.toMatch(/applicantId|reviewedBy/iu);

      const pendingPage = await request(fixture.app.getHttpServer())
        .get('/v1/company/suppliers?status=PENDING_REVIEW&page=1&pageSize=20')
        .expect(200);
      expect(pendingPage.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(pendingPage.body.items[0]).toMatchObject({
        id: created.body.registrationId,
        status: 'PENDING_REVIEW',
        version: 1,
      });

      const correction = await request(fixture.app.getHttpServer())
        .post(`/v1/company/suppliers/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'review-correction-0001')
        .send({
          decision: 'REQUEST_CORRECTION',
          version: 1,
          opinion: '请补充食品经营资质有效期页',
        });
      expect(correction.status).toBe(201);
      expect(correction.body).toMatchObject({ status: 'CORRECTION_REQUIRED', version: 2 });

      const patched = await request(fixture.app.getHttpServer())
        .patch('/v1/supplier/me')
        .set('Idempotency-Key', 'patch-correction-0001')
        .send({
          version: 2,
          qualificationSnapshot: {
            schemaVersion: '1.0',
            files: [
              'object://supplier-qualification/license-001',
              'object://supplier-qualification/food-license-002',
            ],
          },
        });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ status: 'CORRECTION_REQUIRED', version: 3 });

      const resubmitted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/me/submit-review')
        .set('Idempotency-Key', 'submit-lifecycle-0002')
        .send({ version: 3, requestId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
      expect(resubmitted.status).toBe(201);
      expect(resubmitted.body).toMatchObject({ status: 'PENDING', version: 4 });

      const activated = await request(fixture.app.getHttpServer())
        .post(`/v1/company/suppliers/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'review-approve-0001')
        .send({ decision: 'APPROVE', version: 4, opinion: '资料审核通过' });
      expect(activated.status).toBe(201);
      expect(activated.body).toMatchObject({ status: 'ACTIVE', version: 5 });
      expect(await fixture.repository.countStatusHistory(created.body.registrationId)).toBe(5);
    } finally {
      await fixture.app.close();
    }
  });
});
