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
  COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
  DenyCompanyProductApprovalActorResolver,
} from '../company-product-approvals/company-product-approval.actor.js';
import { CompanyProductApprovalService } from '../company-product-approvals/company-product-approval.service.js';
import {
  PUBLIC_CATALOG_REPOSITORY,
  type PublicCatalogRepository,
} from '../catalog/public-catalog.repository.js';
import { PublicCatalogService } from '../catalog/public-catalog.service.js';
import { EnterpriseCatalogService } from '../catalog/enterprise-catalog.service.js';
import {
  DenyEnterpriseCatalogViewerResolver,
  ENTERPRISE_CATALOG_VIEWER_RESOLVER,
} from '../catalog/enterprise-catalog-viewer.resolver.js';
import { CategoryService } from '../categories/category.service.js';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../categories/category.repository.js';
import { CategoryTemplateService } from '../category-templates/category-template.service.js';
import {
  CATEGORY_TEMPLATE_REPOSITORY,
  type CategoryTemplateRepository,
} from '../category-templates/category-template.repository.js';
import {
  REGULATED_CATEGORY_REPOSITORY,
  type RegulatedCategoryRepository,
} from '../regulated-categories/regulated-category.repository.js';
import { RegulatedCategoryService } from '../regulated-categories/regulated-category.service.js';
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
import {
  DenySupplierInventoryActorResolver,
  SUPPLIER_INVENTORY_ACTOR_RESOLVER,
} from '../inventory/inventory.actor.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from '../inventory/inventory.repository.js';
import {
  DenyOrderActorResolver,
  ORDER_ACTOR_RESOLVER,
} from '../orders/order.actor.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../orders/order.repository.js';
import { OrderService } from '../orders/order.service.js';
import {
  SENSITIVE_APPROVAL_REPOSITORY,
  type SensitiveApprovalRepository,
} from '../sensitive-approval/sensitive-approval.repository.js';
import { SensitiveApprovalService } from '../sensitive-approval/sensitive-approval.service.js';
import {
  SUPPLIER_AUTH_SESSION_CREDENTIAL,
  SupplierAuthService,
} from '../supplier-auth/supplier-auth.service.js';
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
import {
  DenySupplierProductActorResolver,
  SUPPLIER_PRODUCT_ACTOR_RESOLVER,
} from '../supplier-products/supplier-product.actor.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type SupplierProductRepository,
} from '../supplier-products/supplier-product.repository.js';
import { SupplierProductService } from '../supplier-products/supplier-product.service.js';
import {
  DenySupplierPricingActorResolver,
  SUPPLIER_PRICING_ACTOR_RESOLVER,
} from '../supplier-pricing/supplier-pricing.actor.js';
import { SupplierPricingService } from '../supplier-pricing/supplier-pricing.service.js';
import { PriceChangeService } from '../price-changes/price-change.service.js';
import {
  PRICE_CHANGE_REPOSITORY,
  type PriceChangeRepository,
} from '../price-changes/price-change.repository.js';
import {
  NoopPriceEffectScheduler,
  PRICE_EFFECT_SCHEDULER,
} from '../price-changes/price-effect.scheduler.js';
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
    SensitiveApprovalService,
    CompanyAuthService,
    CompanyFunctionalAccountService,
    SupplierAuthService,
    {
      provide: SUPPLIER_AUTH_SESSION_CREDENTIAL,
      useValue: `development-only-${'x'.repeat(32)}`,
    },
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
        claimSecondVerification: async () => ({ kind: 'GRANT_INVALID' }),
        completeSecondVerification: async () => false,
        countRecentLoginFailures: async () => 0,
        createSelectionGrant: async () => undefined,
        findSupplierUser: async () => null,
        issueSession: async () => ({ kind: 'GRANT_INVALID' }),
        listSupplierAccounts: async () => [],
        markLoginSucceeded: async () => undefined,
        recordLoginAudit: async () => undefined,
        releaseSecondVerificationClaim: async () => undefined,
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
    {
      provide: SENSITIVE_APPROVAL_REPOSITORY,
      useValue: {
        create: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        list: async () => [],
        claim: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        decide: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
      } satisfies SensitiveApprovalRepository,
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
    SupplierProductService,
    SupplierPricingService,
    PriceChangeService,
    InventoryService,
    OrderService,
    DenySupplierInventoryActorResolver,
    DenyOrderActorResolver,
    NoopPriceEffectScheduler,
    CompanyProductApprovalService,
    PublicCatalogService,
    EnterpriseCatalogService,
    DenyEnterpriseCatalogViewerResolver,
    {
      provide: ENTERPRISE_CATALOG_VIEWER_RESOLVER,
      useExisting: DenyEnterpriseCatalogViewerResolver,
    },
    CategoryService,
    CategoryTemplateService,
    RegulatedCategoryService,
    DenyCompanyProductApprovalActorResolver,
    DenySupplierProductActorResolver,
    DenySupplierPricingActorResolver,
    {
      provide: PRICE_CHANGE_REPOSITORY,
      useValue: {
        listSupplierSkus: async () => [],
        listSupplierSupplyReviews: async () => [],
        listCompanySupplyReviews: async () => [],
        findCompanySupplyReview: async () => null,
        listSupplyReviewHistory: async () => null,
        submitSupplyChange: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        patchSalePrices: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        decideSupplyChange: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        effect: async () => undefined,
        markEffectFailed: async () => undefined,
        listPendingEffects: async () => [],
      } satisfies PriceChangeRepository,
    },
    {
      provide: PRICE_EFFECT_SCHEDULER,
      useExisting: NoopPriceEffectScheduler,
    },
    {
      provide: INVENTORY_REPOSITORY,
      useValue: {
        list: async () => [],
        history: async () => [],
        adjust: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        reserve: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        release: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
        confirmSale: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
      } satisfies InventoryRepository,
    },
    {
      provide: SUPPLIER_INVENTORY_ACTOR_RESOLVER,
      useExisting: DenySupplierInventoryActorResolver,
    },
    {
      provide: ORDER_REPOSITORY,
      useValue: {
        findOrderableSkus: async () => [],
        createOrder: async () => { throw new Error('OPENAPI_GENERATION_ONLY'); },
      } satisfies OrderRepository,
    },
    {
      provide: ORDER_ACTOR_RESOLVER,
      useExisting: DenyOrderActorResolver,
    },
    {
      provide: SUPPLIER_PRODUCT_REPOSITORY,
      useValue: {
        replayMutation: async () => null,
        categoryIsReferenced: async () => false,
        findOwnedProduct: async () => null,
        findCategoryAssignment: async () => null,
        createDraft: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        patchDraft: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        submitMaterial: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        stageInitialPrices: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        listSupplierInitialPricingProducts: async () => [],
        listMaterialReviews: async () => [],
        listInitialPriceReviews: async () => [],
        decideProductApproval: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        resolvePublicationCandidate: async () => null,
        materializeApproved: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        findSellableProductBySupplierProductId: async () => null,
        changeChannelVisibility: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        listChannelVisibilityHistory: async () => [],
      } satisfies SupplierProductRepository,
    },
    {
      provide: CATEGORY_REPOSITORY,
      useValue: {
        list: async () => [],
        findForCompany: async () => null,
        hasChildren: async () => false,
        create: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        patch: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        delete: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        validateSupplierAssignment: async () => ({ kind: 'CATEGORY_NOT_FOUND' }),
      } satisfies CategoryRepository,
    },
    {
      provide: CATEGORY_TEMPLATE_REPOSITORY,
      useValue: {
        list: async () => ({ kind: 'CATEGORY_NOT_FOUND' }),
        createDraft: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        patchDraft: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        publish: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        validateCurrent: async () => ({ kind: 'TEMPLATE_VERSION_INACTIVE' }),
        categoryIsReferenced: async () => false,
      } satisfies CategoryTemplateRepository,
    },
    {
      provide: REGULATED_CATEGORY_REPOSITORY,
      useValue: {
        list: async () => [],
        find: async () => null,
        enable: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
        disable: async () => {
          throw new Error('OPENAPI_GENERATION_ONLY');
        },
      } satisfies RegulatedCategoryRepository,
    },
    {
      provide: SUPPLIER_PRODUCT_ACTOR_RESOLVER,
      useExisting: DenySupplierProductActorResolver,
    },
    {
      provide: SUPPLIER_PRICING_ACTOR_RESOLVER,
      useExisting: DenySupplierPricingActorResolver,
    },
    {
      provide: COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
      useExisting: DenyCompanyProductApprovalActorResolver,
    },
    {
      provide: PUBLIC_CATALOG_REPOSITORY,
      useValue: {
        isActiveSupplierSource: async () => false,
        findSellableProductDetail: async () => null,
        findSellableRetailProducts: async () => ({ items: [], total: 0 }),
        findSellableRetailCatalogProducts: async () => ({ items: [], total: 0 }),
        findSellableEnterpriseProducts: async () => ({ items: [], total: 0 }),
      } satisfies PublicCatalogRepository,
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
      .addCookieAuth(
        '__Host-fulishe-enterprise-portal',
        { type: 'apiKey', in: 'cookie' },
        'enterpriseSession',
      )
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
