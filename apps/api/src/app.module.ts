import { Module, type DynamicModule, type Provider } from '@nestjs/common';

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
