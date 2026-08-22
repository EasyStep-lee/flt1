import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryBusinessInquiryRepository } from '../../dist/business-inquiries/in-memory-business-inquiry.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    PORTAL_PUBLIC_ORIGIN: 'https://fulishe.example.invalid',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const body = (overrides = {}) => ({
  contactName: '李经理',
  enterpriseName: '南京示例企业有限公司',
  mobile: '13800138000',
  demandSummary: '计划为员工申请节日福利卡并了解适用范围。',
  consentToUse: true,
  ...overrides,
});

const createFixture = async ({ captchaAvailable = true, dataProtectionAvailable = true } = {}) => {
  const repository = new InMemoryBusinessInquiryRepository([company]);
  const app = await createApplication({
    config: config(),
    probes: probes(),
    businessInquiryRepository: repository,
    ...(dataProtectionAvailable
      ? {
          businessInquiryDataProtector: {
            protectMobile: async (mobile) => `encrypted:test:${mobile.length}`,
          },
        }
      : {}),
    ...(captchaAvailable
      ? {
          businessInquiryCaptchaVerifier: {
            verify: async ({ token }) => token === 'captcha-pass',
          },
        }
      : {}),
    logger: false,
  });
  await app.init();
  return { app, repository };
};

const submit = (fixture, key, payload = body(), headers = {}) =>
  request(fixture.app.getHttpServer())
    .post('/v1/public/business-inquiries')
    .set('Idempotency-Key', key)
    .set('Origin', 'https://fulishe.example.invalid')
    .set('Sec-Fetch-Site', 'same-site')
    .set('X-Captcha-Token', 'captcha-pass')
    .set(headers)
    .send(payload);

describe('P0-076 public enterprise welfare inquiry API', () => {
  it('creates and exactly replays one allowlisted lead without creating welfare funds', async () => {
    const fixture = await createFixture();
    try {
      const first = await submit(fixture, 'business-inquiry-replay-0001');
      const replay = await submit(fixture, 'business-inquiry-replay-0001');
      expect(first.status).toBe(201);
      expect(first.headers['cache-control']).toContain('no-store');
      expect(first.headers['x-robots-tag']).toContain('noindex');
      expect(first.body).toEqual({
        leadNumber: expect.stringMatching(/^FLX\d{8}[A-Z0-9]{8}$/u),
        status: 'SUBMITTED',
        submittedAt: expect.stringMatching(/Z$/u),
        useNotice: expect.any(String),
        contactExpectation: expect.any(String),
        modificationOrWithdrawalChannel: '189****9999',
      });
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(fixture.repository.countInquiries()).toBe(1);
      expect(fixture.repository.countAuditEvents()).toBe(1);
      expect(fixture.repository.countWelfareAccountsCreated()).toBe(0);
      expect(JSON.stringify(first.body)).not.toMatch(
        /13800138000|南京示例企业|companyId|inquiryId|sourceFingerprint|supplyPrice/iu,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M3-P076-01 rejects invalid, unconsented and client-owned fields without writing', async () => {
    const fixture = await createFixture();
    try {
      const invalid = await submit(fixture, 'business-inquiry-invalid-0001', body({ mobile: '123' }));
      expect(invalid.status).toBe(422);
      expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      const unconsented = await submit(
        fixture,
        'business-inquiry-consent-0001',
        body({ consentToUse: false }),
      );
      expect(unconsented.status).toBe(422);
      expect(unconsented.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      const tampered = await submit(
        fixture,
        'business-inquiry-owner-0001',
        body({ companyId: company.id, fundingAmount: 10000 }),
      );
      expect(tampered.status).toBe(403);
      expect(tampered.body).toMatchObject({ code: 'FIELD_FORBIDDEN' });
      expect(fixture.repository.countInquiries()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M3-P076-02 fails closed for wrong origin, invalid captcha and unavailable verifier', async () => {
    const fixture = await createFixture();
    try {
      const wrongOrigin = await submit(fixture, 'business-inquiry-origin-0001', body(), {
        Origin: 'https://attacker.example',
      });
      expect(wrongOrigin.status).toBe(403);
      expect(wrongOrigin.body).toMatchObject({ code: 'ACCESS_DENIED' });
      const captcha = await submit(fixture, 'business-inquiry-captcha-0001', body(), {
        'X-Captcha-Token': 'captcha-fail',
      });
      expect(captcha.status).toBe(403);
      expect(captcha.body).toMatchObject({ code: 'ACCESS_DENIED' });
      expect(fixture.repository.countInquiries()).toBe(0);
    } finally {
      await fixture.app.close();
    }

    const unavailable = await createFixture({ captchaAvailable: false });
    try {
      const response = await submit(unavailable, 'business-inquiry-unavailable-0001');
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(unavailable.repository.countInquiries()).toBe(0);
    } finally {
      await unavailable.app.close();
    }

    const unprotected = await createFixture({ dataProtectionAvailable: false });
    try {
      const response = await submit(unprotected, 'business-inquiry-unprotected-0001');
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(unprotected.repository.countInquiries()).toBe(0);
    } finally {
      await unprotected.app.close();
    }
  });

  it('NEG-M3-P076-03 rejects a conflicting replay and rate limits before another write', async () => {
    const fixture = await createFixture();
    try {
      const first = await submit(fixture, 'business-inquiry-conflict-0001');
      expect(first.status).toBe(201);
      const conflict = await submit(
        fixture,
        'business-inquiry-conflict-0001',
        body({ demandSummary: '这是一段不同的企业福利卡咨询需求摘要。' }),
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      for (let index = 0; index < 4; index += 1) {
        const accepted = await submit(fixture, `business-inquiry-limit-${index}-0001`);
        expect(accepted.status).toBe(201);
      }
      const limited = await submit(fixture, 'business-inquiry-limit-blocked-0001');
      expect(limited.status).toBe(429);
      expect(limited.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(fixture.repository.countInquiries()).toBe(5);
    } finally {
      await fixture.app.close();
    }
  });
});
