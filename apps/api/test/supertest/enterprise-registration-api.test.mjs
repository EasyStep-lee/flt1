import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemoryEnterpriseOnboardingRepository } from '../../dist/enterprise-onboarding/in-memory-enterprise-onboarding.repository.js';

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
const applicantIdentityId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const reviewerIdentityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const completeRegistrationBody = (overrides = {}) => ({
  legalName: '南京示例企业有限公司',
  creditCode: '91320100MA1ABC2D3X',
  administratorName: '李经理',
  administratorMobile: '13800138000',
  administratorEmail: 'buyer@example.test',
  administratorTitle: '采购负责人',
  verificationCode: '123456',
  agreementVersion: 'enterprise-procurement-v1.1',
  registeredAddress: '南京市建邺区江东中路 100 号',
  enterpriseType: 'LIMITED_COMPANY',
  licenseObjectKey: 'object://enterprise-certification/license-001',
  licenseValidUntil: '2030-12-31',
  addresses: [
    {
      consignee: '李经理',
      mobile: '13800138000',
      region: '江苏省南京市建邺区',
      fullAddress: '江东中路 100 号',
      deliveryNote: '工作日收货',
      isDefault: true,
    },
  ],
  invoiceProfile: {
    title: '南京示例企业有限公司',
    taxNumber: '91320100MA1ABC2D3X',
    registeredAddress: '南京市建邺区江东中路 100 号',
    registeredPhone: '025-88886666',
    bankName: '示例银行南京分行',
    bankAccount: '6222020202020202020',
  },
  ...overrides,
});

const createFixture = async ({ safeDefault = false } = {}) => {
  const repository = new InMemoryEnterpriseOnboardingRepository([company]);
  const reviewer = { current: reviewerIdentityId };
  const options = {
    config: config(),
    probes: probes(),
    merchantRepository: { findCustomerFacingCompanies: async () => [company] },
    enterpriseOnboardingRepository: repository,
    logger: false,
  };
  if (!safeDefault) {
    options.enterpriseRegistrationVerifier = {
      verify: async () => ({ identityId: applicantIdentityId }),
    };
    options.enterpriseOnboardingActorResolver = {
      resolve: async () => ({
        role: 'COMPANY_SUPPLIER_OPS',
        companyId: company.id,
        identityId: reviewer.current,
      }),
    };
  }
  const app = await createApplication(options);
  await app.init();
  return { app, repository, reviewer };
};

const register = (fixture, key, body = completeRegistrationBody()) =>
  request(fixture.app.getHttpServer())
    .post('/v1/enterprise/registrations')
    .set('Idempotency-Key', key)
    .send(body);

const auth = (token) => ({ Authorization: `Registration ${token}` });

describe('P0-028/P0-077 enterprise registration and certification API', () => {
  it('fails closed when external mobile verification is unavailable', async () => {
    const fixture = await createFixture({ safeDefault: true });
    try {
      const response = await register(fixture, 'enterprise-safe-default-0001');
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(fixture.repository.countEnterprises()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M3-P028-01 rejects invalid or client-controlled ownership fields', async () => {
    const fixture = await createFixture();
    try {
      const invalid = await register(
        fixture,
        'enterprise-invalid-credit-0001',
        completeRegistrationBody({ creditCode: 'invalid' }),
      );
      expect(invalid.status).toBe(422);
      expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED' });

      const tampered = await register(
        fixture,
        'enterprise-owner-tamper-0001',
        completeRegistrationBody({ companyId: company.id, status: 'ACTIVE' }),
      );
      expect(tampered.status).toBe(403);
      expect(tampered.body).toMatchObject({ code: 'FIELD_FORBIDDEN' });
      expect(fixture.repository.countEnterprises()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('creates and replays one private draft while rejecting duplicate credit codes', async () => {
    const fixture = await createFixture();
    try {
      const first = await register(fixture, 'enterprise-create-replay-0001');
      const replay = await register(fixture, 'enterprise-create-replay-0001');
      expect(first.status).toBe(201);
      expect(first.headers['cache-control']).toContain('no-store');
      expect(first.headers['x-robots-tag']).toContain('noindex');
      expect(first.body).toMatchObject({
        registrationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        status: 'DRAFT',
        version: 0,
        nextAction: 'COMPLETE_PROFILE',
        registrationAccessToken: expect.any(String),
      });
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(fixture.repository.countEnterprises()).toBe(1);

      const conflictingReplay = await register(
        fixture,
        'enterprise-create-replay-0001',
        completeRegistrationBody({ legalName: '不同企业名称有限公司' }),
      );
      expect(conflictingReplay.status).toBe(409);
      expect(conflictingReplay.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      const duplicate = await register(
        fixture,
        'enterprise-duplicate-credit-0001',
        completeRegistrationBody({ creditCode: '91320100ma1abc2d3x' }),
      );
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'CREDIT_CODE_DUPLICATE' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M3-P028-02 derives applicant ownership only from the signed credential', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(fixture, 'enterprise-owner-scope-0001');
      const token = created.body.registrationAccessToken;
      const own = await request(fixture.app.getHttpServer())
        .get('/v1/enterprise/registrations/me?enterpriseId=client-controlled')
        .set(auth(token));
      expect(own.status).toBe(200);
      expect(own.body.id).toBe(created.body.registrationId);

      const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
      const forbidden = await request(fixture.app.getHttpServer())
        .get('/v1/enterprise/registrations/me')
        .set(auth(tamperedToken));
      expect(forbidden.status).toBe(401);
      expect(forbidden.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

      const ownershipField = await request(fixture.app.getHttpServer())
        .patch('/v1/enterprise/registrations/me')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-owner-field-0001')
        .send({ version: 0, enterpriseCustomerId: 'client-controlled' });
      expect(ownershipField.status).toBe(403);
      expect(ownershipField.body).toMatchObject({ code: 'FIELD_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps an incomplete draft editable after submit validation fails', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(
        fixture,
        'enterprise-incomplete-0001',
        completeRegistrationBody({
          registeredAddress: undefined,
          enterpriseType: undefined,
          licenseObjectKey: undefined,
          administratorEmail: undefined,
          administratorTitle: undefined,
          addresses: undefined,
          invoiceProfile: undefined,
        }),
      );
      const token = created.body.registrationAccessToken;
      const submit = await request(fixture.app.getHttpServer())
        .post('/v1/enterprise/registrations/me/submit-review')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-incomplete-submit-0001')
        .send({ version: 0 });
      expect(submit.status).toBe(422);
      expect(submit.body).toMatchObject({ code: 'VALIDATION_FAILED' });

      const patch = await request(fixture.app.getHttpServer())
        .patch('/v1/enterprise/registrations/me')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-incomplete-patch-0001')
        .send({
          version: 0,
          registeredAddress: '南京市建邺区江东中路 100 号',
          enterpriseType: 'LIMITED_COMPANY',
        });
      expect(patch.status).toBe(200);
      expect(patch.body).toMatchObject({ status: 'DRAFT', version: 1 });
    } finally {
      await fixture.app.close();
    }
  });

  it('moves through correction, resubmission and activation with masked responses', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(fixture, 'enterprise-lifecycle-0001');
      const token = created.body.registrationAccessToken;
      const submitted = await request(fixture.app.getHttpServer())
        .post('/v1/enterprise/registrations/me/submit-review')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-submit-0001')
        .send({ version: 0 });
      expect(submitted.status).toBe(201);
      expect(submitted.body).toMatchObject({ status: 'PENDING_REVIEW', version: 1 });

      const listed = await request(fixture.app.getHttpServer())
        .get('/v1/company/enterprise-registrations?status=PENDING_REVIEW&page=1&pageSize=20');
      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });

      const correction = await request(fixture.app.getHttpServer())
        .post(`/v1/company/enterprise-registrations/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'enterprise-correction-0001')
        .send({
          decision: 'REQUEST_CORRECTION',
          version: 1,
          opinion: '请补充发票资料',
          correctionFields: ['INVOICE_PROFILE'],
        });
      expect(correction.status).toBe(201);
      expect(correction.body).toMatchObject({
        status: 'CORRECTION_REQUIRED',
        version: 2,
        correctionFields: ['INVOICE_PROFILE'],
      });

      const patched = await request(fixture.app.getHttpServer())
        .patch('/v1/enterprise/registrations/me')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-correction-patch-0001')
        .send({
          version: 2,
          invoiceProfile: {
            title: '南京示例企业有限公司',
            taxNumber: '91320100MA1ABC2D3X',
            bankName: '示例银行南京分行',
            bankAccount: '6222020202020202020',
          },
        });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ status: 'CORRECTION_REQUIRED', version: 3 });

      const resubmitted = await request(fixture.app.getHttpServer())
        .post('/v1/enterprise/registrations/me/submit-review')
        .set(auth(token))
        .set('Idempotency-Key', 'enterprise-resubmit-0001')
        .send({ version: 3 });
      expect(resubmitted.status).toBe(201);
      expect(resubmitted.body).toMatchObject({ status: 'PENDING_REVIEW', version: 4 });

      const activated = await request(fixture.app.getHttpServer())
        .post(`/v1/company/enterprise-registrations/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'enterprise-approve-0001')
        .send({ decision: 'APPROVE', version: 4, opinion: '企业认证通过' });
      expect(activated.status).toBe(201);
      expect(activated.body).toMatchObject({
        status: 'ACTIVE',
        version: 5,
        nextAction: 'ENTER_WORKSPACE',
      });
      expect(fixture.repository.countStatusHistory(created.body.registrationId)).toBe(5);
      expect(fixture.repository.countSnapshots(created.body.registrationId)).toBe(6);

      const serialized = JSON.stringify(activated.body);
      expect(serialized).not.toContain('91320100MA1ABC2D3X');
      expect(serialized).not.toContain('13800138000');
      expect(serialized).not.toContain('6222020202020202020');
      expect(serialized).not.toMatch(/companyId|applicantIdentityId|verificationCode/iu);
      expect(activated.body.invoiceProfile).toMatchObject({
        taxNumberMasked: '9132********2D3X',
        bankAccountMasked: '**** **** **** 2020',
      });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M3-P028-03 rejects self-review and allows only one concurrent review', async () => {
    const fixture = await createFixture();
    try {
      const created = await register(fixture, 'enterprise-concurrency-0001');
      const submitted = await request(fixture.app.getHttpServer())
        .post('/v1/enterprise/registrations/me/submit-review')
        .set(auth(created.body.registrationAccessToken))
        .set('Idempotency-Key', 'enterprise-concurrency-submit-0001')
        .send({ version: 0 });
      expect(submitted.status).toBe(201);

      fixture.reviewer.current = applicantIdentityId;
      const selfReview = await request(fixture.app.getHttpServer())
        .post(`/v1/company/enterprise-registrations/${created.body.registrationId}/review`)
        .set('Idempotency-Key', 'enterprise-self-review-0001')
        .send({ decision: 'APPROVE', version: 1, opinion: '自审' });
      expect(selfReview.status).toBe(403);
      expect(selfReview.body).toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });

      fixture.reviewer.current = reviewerIdentityId;
      const results = await Promise.all([
        request(fixture.app.getHttpServer())
          .post(`/v1/company/enterprise-registrations/${created.body.registrationId}/review`)
          .set('Idempotency-Key', 'enterprise-concurrent-review-a')
          .send({ decision: 'APPROVE', version: 1, opinion: '通过' }),
        request(fixture.app.getHttpServer())
          .post(`/v1/company/enterprise-registrations/${created.body.registrationId}/review`)
          .set('Idempotency-Key', 'enterprise-concurrent-review-b')
          .send({ decision: 'REJECT', version: 1, opinion: '驳回' }),
      ]);
      expect(results.map((item) => item.status).sort()).toEqual([201, 409]);
      expect(results.find((item) => item.status === 409)?.body).toMatchObject({
        code: 'APPROVAL_VERSION_CONFLICT',
      });
    } finally {
      await fixture.app.close();
    }
  });
});
