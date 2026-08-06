import { Module, type DynamicModule, type Provider } from '@nestjs/common';

import {
  AUDIT_ACTOR_RESOLVER,
  DenyAuditActorResolver,
  type AuditActorResolver,
} from './audit/audit-log.actor.js';
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepository,
} from './audit/audit-log.repository.js';
import { AuditLogService } from './audit/audit-log.service.js';
import { PrismaAuditLogRepository } from './audit/prisma-audit-log.repository.js';
import { CompanyAuthService } from './company-auth/company-auth.service.js';
import { PrismaCompanyAuthRepository } from './company-auth/prisma-company-auth.repository.js';
import {
  COMPANY_AUTH_REPOSITORY,
  type CompanyAuthRepository,
} from './company-auth/company-auth.repository.js';
import {
  COMPANY_CREDENTIAL_VERIFIER,
  COMPANY_SECOND_VERIFIER,
  UnavailableCompanyCredentialVerifier,
  UnavailableCompanySecondVerifier,
  type CompanyCredentialVerifier,
  type CompanySecondVerifier,
} from './company-auth/company-auth.security.js';

import { RUNTIME_CONFIG, type RuntimeConfig } from './config/runtime-config.js';
import { HealthService } from './health/health.service.js';
import {
  FOUNDATION_PROBES,
  HEALTH_PROBE_TIMEOUT_MS,
  type InfrastructureProbe,
} from './infrastructure/probe.js';
import { PrismaService } from './infrastructure/prisma.service.js';
import { QueueService } from './infrastructure/queue.service.js';
import { RedisService } from './infrastructure/redis.service.js';
import { PrismaSingleMerchantRepository } from './merchant/prisma-single-merchant.repository.js';
import {
  SINGLE_MERCHANT_REPOSITORY,
  type SingleMerchantRepository,
} from './merchant/single-merchant.repository.js';
import { SingleMerchantService } from './merchant/single-merchant.service.js';
import { OPENAPI_CONTROLLERS } from './openapi/openapi-controller.registry.js';
import {
  DenyFunctionalAccountActorResolver,
  FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
  type FunctionalAccountActorResolver,
} from './supplier-functional-accounts/supplier-functional-account.actor.js';
import { PrismaSupplierFunctionalAccountRepository } from './supplier-functional-accounts/prisma-supplier-functional-account.repository.js';
import {
  FUNCTIONAL_ACCOUNT_REPOSITORY,
  type SupplierFunctionalAccountRepository,
} from './supplier-functional-accounts/supplier-functional-account.repository.js';
import {
  FUNCTIONAL_ACCOUNT_AUDIT_SINK,
  FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
  LoggingFunctionalAccountAuditSink,
  UnavailableFunctionalAccountSecondVerifier,
  type FunctionalAccountAuditSink,
  type FunctionalAccountSecondVerifier,
} from './supplier-functional-accounts/supplier-functional-account.security.js';
import { SupplierFunctionalAccountService } from './supplier-functional-accounts/supplier-functional-account.service.js';
import {
  DenySupplierOnboardingActorResolver,
  SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
  type SupplierOnboardingActorResolver,
} from './supplier-onboarding/supplier-onboarding.actor.js';
import { PrismaSupplierOnboardingRepository } from './supplier-onboarding/prisma-supplier-onboarding.repository.js';
import {
  SUPPLIER_ONBOARDING_REPOSITORY,
  type SupplierOnboardingRepository,
} from './supplier-onboarding/supplier-onboarding.repository.js';
import { SupplierOnboardingService } from './supplier-onboarding/supplier-onboarding.service.js';
import {
  SUPPLIER_REGISTRATION_VERIFIER,
  UnavailableSupplierRegistrationVerifier,
  type SupplierRegistrationVerifier,
} from './supplier-onboarding/supplier-registration.verifier.js';

export interface AppModuleOptions {
  readonly config: RuntimeConfig;
  readonly probes?: readonly InfrastructureProbe[];
  readonly merchantRepository?: SingleMerchantRepository;
  readonly supplierOnboardingRepository?: SupplierOnboardingRepository;
  readonly supplierOnboardingActorResolver?: SupplierOnboardingActorResolver;
  readonly supplierRegistrationVerifier?: SupplierRegistrationVerifier;
  readonly functionalAccountRepository?: SupplierFunctionalAccountRepository;
  readonly functionalAccountActorResolver?: FunctionalAccountActorResolver;
  readonly functionalAccountSecondVerifier?: FunctionalAccountSecondVerifier;
  readonly functionalAccountAuditSink?: FunctionalAccountAuditSink;
  readonly auditLogRepository?: AuditLogRepository;
  readonly auditActorResolver?: AuditActorResolver;
  readonly companyAuthRepository?: CompanyAuthRepository;
  readonly companyCredentialVerifier?: CompanyCredentialVerifier;
  readonly companySecondVerifier?: CompanySecondVerifier;
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: RUNTIME_CONFIG, useValue: options.config },
      {
        provide: HEALTH_PROBE_TIMEOUT_MS,
        useValue: options.config.healthProbeTimeoutMs,
      },
      HealthService,
      PrismaService,
      PrismaSingleMerchantRepository,
      SingleMerchantService,
      PrismaSupplierOnboardingRepository,
      DenySupplierOnboardingActorResolver,
      UnavailableSupplierRegistrationVerifier,
      SupplierOnboardingService,
      PrismaSupplierFunctionalAccountRepository,
      DenyFunctionalAccountActorResolver,
      UnavailableFunctionalAccountSecondVerifier,
      LoggingFunctionalAccountAuditSink,
      SupplierFunctionalAccountService,
      PrismaAuditLogRepository,
      DenyAuditActorResolver,
      AuditLogService,
      PrismaCompanyAuthRepository,
      UnavailableCompanyCredentialVerifier,
      UnavailableCompanySecondVerifier,
      CompanyAuthService,
      options.merchantRepository
        ? {
            provide: SINGLE_MERCHANT_REPOSITORY,
            useValue: options.merchantRepository,
          }
        : {
            provide: SINGLE_MERCHANT_REPOSITORY,
            useExisting: PrismaSingleMerchantRepository,
          },
      options.supplierOnboardingRepository
        ? {
            provide: SUPPLIER_ONBOARDING_REPOSITORY,
            useValue: options.supplierOnboardingRepository,
          }
        : {
            provide: SUPPLIER_ONBOARDING_REPOSITORY,
            useExisting: PrismaSupplierOnboardingRepository,
          },
      options.supplierOnboardingActorResolver
        ? {
            provide: SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
            useValue: options.supplierOnboardingActorResolver,
          }
        : {
            provide: SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
            useExisting: DenySupplierOnboardingActorResolver,
          },
      options.supplierRegistrationVerifier
        ? {
            provide: SUPPLIER_REGISTRATION_VERIFIER,
            useValue: options.supplierRegistrationVerifier,
          }
        : {
            provide: SUPPLIER_REGISTRATION_VERIFIER,
            useExisting: UnavailableSupplierRegistrationVerifier,
          },
      options.functionalAccountRepository
        ? {
            provide: FUNCTIONAL_ACCOUNT_REPOSITORY,
            useValue: options.functionalAccountRepository,
          }
        : {
            provide: FUNCTIONAL_ACCOUNT_REPOSITORY,
            useExisting: PrismaSupplierFunctionalAccountRepository,
          },
      options.functionalAccountActorResolver
        ? {
            provide: FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
            useValue: options.functionalAccountActorResolver,
          }
        : {
            provide: FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
            useExisting: DenyFunctionalAccountActorResolver,
          },
      options.functionalAccountSecondVerifier
        ? {
            provide: FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
            useValue: options.functionalAccountSecondVerifier,
          }
        : {
            provide: FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
            useExisting: UnavailableFunctionalAccountSecondVerifier,
          },
      options.functionalAccountAuditSink
        ? {
            provide: FUNCTIONAL_ACCOUNT_AUDIT_SINK,
            useValue: options.functionalAccountAuditSink,
          }
        : {
            provide: FUNCTIONAL_ACCOUNT_AUDIT_SINK,
            useExisting: LoggingFunctionalAccountAuditSink,
          },
      options.auditLogRepository
        ? { provide: AUDIT_LOG_REPOSITORY, useValue: options.auditLogRepository }
        : { provide: AUDIT_LOG_REPOSITORY, useExisting: PrismaAuditLogRepository },
      options.auditActorResolver
        ? { provide: AUDIT_ACTOR_RESOLVER, useValue: options.auditActorResolver }
        : { provide: AUDIT_ACTOR_RESOLVER, useExisting: DenyAuditActorResolver },
      options.companyAuthRepository
        ? { provide: COMPANY_AUTH_REPOSITORY, useValue: options.companyAuthRepository }
        : { provide: COMPANY_AUTH_REPOSITORY, useExisting: PrismaCompanyAuthRepository },
      options.companyCredentialVerifier
        ? {
            provide: COMPANY_CREDENTIAL_VERIFIER,
            useValue: options.companyCredentialVerifier,
          }
        : {
            provide: COMPANY_CREDENTIAL_VERIFIER,
            useExisting: UnavailableCompanyCredentialVerifier,
          },
      options.companySecondVerifier
        ? { provide: COMPANY_SECOND_VERIFIER, useValue: options.companySecondVerifier }
        : {
            provide: COMPANY_SECOND_VERIFIER,
            useExisting: UnavailableCompanySecondVerifier,
          },
    ];

    if (options.probes) {
      providers.push({ provide: FOUNDATION_PROBES, useValue: options.probes });
    } else {
      providers.push(
        RedisService,
        QueueService,
        {
          provide: FOUNDATION_PROBES,
          inject: [PrismaService, RedisService, QueueService],
          useFactory: (
            database: PrismaService,
            redis: RedisService,
            queue: QueueService,
          ): readonly InfrastructureProbe[] => [database, redis, queue],
        },
      );
    }

    return {
      module: AppModule,
      controllers: [...OPENAPI_CONTROLLERS],
      providers,
    };
  }
}
