import {
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

import {
  AUDIT_ACTOR_RESOLVER,
  DenyAuditActorResolver,
} from '../audit/audit-log.actor.js';
import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import {
  COMPANY_AUTH_REPOSITORY,
  type CompanyAuthRepository,
} from '../company-auth/company-auth.repository.js';
import {
  COMPANY_CREDENTIAL_VERIFIER,
  COMPANY_SECOND_VERIFIER,
  UnavailableCompanyCredentialVerifier,
  UnavailableCompanySecondVerifier,
} from '../company-auth/company-auth.security.js';
import { CompanyFunctionalAccountService } from '../company-functional-accounts/company-functional-account.service.js';
import {
  COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
  type CompanyFunctionalAccountRepository,
} from '../company-functional-accounts/company-functional-account.repository.js';
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepository,
} from '../audit/audit-log.repository.js';
import { AuditLogService } from '../audit/audit-log.service.js';

import { HealthLivenessDto, HealthReadinessDto } from '../health/health.dto.js';
import { HealthService } from '../health/health.service.js';
import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  FOUNDATION_PROBES,
  HEALTH_PROBE_TIMEOUT_MS,
} from '../infrastructure/probe.js';
import {
  SINGLE_MERCHANT_REPOSITORY,
  type SingleMerchantRepository,
} from '../merchant/single-merchant.repository.js';
import { SingleMerchantService } from '../merchant/single-merchant.service.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import {
  SUPPLIER_AUTH_REPOSITORY,
  type SupplierAuthRepository,
} from '../supplier-auth/supplier-auth.repository.js';
import {
  SUPPLIER_CREDENTIAL_VERIFIER,
  SUPPLIER_SECOND_VERIFIER,
  UnavailableSupplierCredentialVerifier,
  UnavailableSupplierSecondVerifier,
} from '../supplier-auth/supplier-auth.security.js';
import {
  DenyFunctionalAccountActorResolver,
  FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
} from '../supplier-functional-accounts/supplier-functional-account.actor.js';
import {
  FUNCTIONAL_ACCOUNT_REPOSITORY,
  type SupplierFunctionalAccountRepository,
} from '../supplier-functional-accounts/supplier-functional-account.repository.js';
import {
  FUNCTIONAL_ACCOUNT_AUDIT_SINK,
  FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
  LoggingFunctionalAccountAuditSink,
  UnavailableFunctionalAccountSecondVerifier,
} from '../supplier-functional-accounts/supplier-functional-account.security.js';
import { SupplierFunctionalAccountService } from '../supplier-functional-accounts/supplier-functional-account.service.js';
import {
  DenySupplierOnboardingActorResolver,
  SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
} from '../supplier-onboarding/supplier-onboarding.actor.js';
import {
  SUPPLIER_ONBOARDING_REPOSITORY,
  type SupplierOnboardingRepository,
} from '../supplier-onboarding/supplier-onboarding.repository.js';
import { SupplierOnboardingService } from '../supplier-onboarding/supplier-onboarding.service.js';
import {
  SUPPLIER_REGISTRATION_VERIFIER,
  UnavailableSupplierRegistrationVerifier,
} from '../supplier-onboarding/supplier-registration.verifier.js';
import { OPENAPI_CONTROLLERS } from './openapi-controller.registry.js';
import {
  applyM1OpenApiContracts,
  assertM1OpenApiContracts,
} from './m1-openapi-contract.js';

type JsonValue =
  | boolean
  | null
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

@Module({
  controllers: [...OPENAPI_CONTROLLERS],
  providers: [
    HealthService,
    AuditLogService,
    CompanyAuthService,
    CompanyFunctionalAccountService,
    SupplierAuthService,
    UnavailableSupplierCredentialVerifier,
    UnavailableSupplierSecondVerifier,
    UnavailableCompanyCredentialVerifier,
    UnavailableCompanySecondVerifier,
    {
      provide: COMPANY_AUTH_REPOSITORY,
      useValue: {
        countRecentLoginFailures: async () => 0,
        createSelectionGrant: async () => undefined,
        findCompanyUser: async () => null,
        issueSession: async () => ({ kind: 'GRANT_INVALID' }),
        listCompanyAccounts: async () => [],
        markLoginSucceeded: async () => undefined,
        recordLoginAudit: async () => undefined,
        resolveSession: async () => ({ kind: 'MISSING' }),
        resolveSelectionGrant: async () => null,
      } satisfies CompanyAuthRepository,
    },
    {
      provide: COMPANY_CREDENTIAL_VERIFIER,
      useExisting: UnavailableCompanyCredentialVerifier,
    },
    {
      provide: COMPANY_SECOND_VERIFIER,
      useExisting: UnavailableCompanySecondVerifier,
    },
    {
      provide: COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
      useValue: {
        createCompanyAccount: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        findCompanyAccountByMobile: async () => null,
        isCompanyActive: async () => false,
        listCompanyAccounts: async () => ({ items: [], total: 0 }),
      } satisfies CompanyFunctionalAccountRepository,
    },
    {
      provide: SUPPLIER_AUTH_REPOSITORY,
      useValue: {
        countRecentLoginFailures: async () => 0,
        createSelectionGrant: async () => undefined,
        findSupplierUser: async () => null,
        issueSession: async () => ({ kind: 'GRANT_INVALID' }),
        listSupplierAccounts: async () => [],
        markLoginSucceeded: async () => undefined,
        recordLoginAudit: async () => undefined,
        resolveSelectionGrant: async () => null,
        resolveSession: async () => ({ kind: 'MISSING' }),
      } satisfies SupplierAuthRepository,
    },
    {
      provide: SUPPLIER_CREDENTIAL_VERIFIER,
      useExisting: UnavailableSupplierCredentialVerifier,
    },
    {
      provide: SUPPLIER_SECOND_VERIFIER,
      useExisting: UnavailableSupplierSecondVerifier,
    },
    DenyAuditActorResolver,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useValue: {
        append: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        list: async () => ({ items: [], total: 0 }),
      } satisfies AuditLogRepository,
    },
    {
      provide: AUDIT_ACTOR_RESOLVER,
      useExisting: DenyAuditActorResolver,
    },
    { provide: FOUNDATION_PROBES, useValue: [] },
    { provide: HEALTH_PROBE_TIMEOUT_MS, useValue: 50 },
    SingleMerchantService,
    {
      provide: SINGLE_MERCHANT_REPOSITORY,
      useValue: {
        findCustomerFacingCompanies: async () => [],
      } satisfies SingleMerchantRepository,
    },
    SupplierOnboardingService,
    DenySupplierOnboardingActorResolver,
    UnavailableSupplierRegistrationVerifier,
    {
      provide: SUPPLIER_ONBOARDING_REPOSITORY,
      useValue: {
        register: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        findSupplier: async () => null,
        patchSupplier: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        submitSupplier: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        listSuppliers: async () => ({ items: [], total: 0 }),
        reviewSupplier: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
      } satisfies SupplierOnboardingRepository,
    },
    {
      provide: SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
      useExisting: DenySupplierOnboardingActorResolver,
    },
    {
      provide: SUPPLIER_REGISTRATION_VERIFIER,
      useExisting: UnavailableSupplierRegistrationVerifier,
    },
    SupplierFunctionalAccountService,
    DenyFunctionalAccountActorResolver,
    UnavailableFunctionalAccountSecondVerifier,
    LoggingFunctionalAccountAuditSink,
    {
      provide: FUNCTIONAL_ACCOUNT_REPOSITORY,
      useValue: {
        createAccount: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        findAccount: async () => null,
        findAccountByMobile: async () => null,
        isSupplierActive: async () => false,
        listAccounts: async () => ({ items: [], total: 0 }),
      } satisfies SupplierFunctionalAccountRepository,
    },
    {
      provide: FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
      useExisting: DenyFunctionalAccountActorResolver,
    },
    {
      provide: FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
      useExisting: UnavailableFunctionalAccountSecondVerifier,
    },
    {
      provide: FUNCTIONAL_ACCOUNT_AUDIT_SINK,
      useExisting: LoggingFunctionalAccountAuditSink,
    },
  ],
})
class OpenApiGenerationModule {}

const sortJsonValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    );
  }
  return value;
};

const stableDocument = (document: OpenAPIObject): OpenAPIObject =>
  sortJsonValue(
    JSON.parse(JSON.stringify(document)) as JsonValue,
  ) as unknown as OpenAPIObject;

export const createDeterministicOpenApiDocument = async (): Promise<OpenAPIObject> => {
  const app = await NestFactory.create(OpenApiGenerationModule, {
    abortOnError: true,
    logger: false,
  });

  try {
    await app.init();
    const configuration = new DocumentBuilder()
      .setTitle('福礼社统一 API')
      .setDescription('江苏福礼团供应链科技有限公司单商户平台 API 契约')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, configuration, {
      extraModels: [
        ApiErrorResponseDto,
        HealthLivenessDto,
        HealthReadinessDto,
      ],
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey.replace(/Controller$/u, '').toLowerCase()}.${methodKey}`,
    });
    applyM1OpenApiContracts(document);
    assertM1OpenApiContracts(document);
    const sorted = stableDocument(document);
    return sorted;
  } finally {
    await app.close();
  }
};
