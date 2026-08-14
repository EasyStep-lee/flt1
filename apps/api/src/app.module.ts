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
import { AuditSessionActorResolver } from './audit/audit-session-actor.resolver.js';
import { PrismaAuditLogRepository } from './audit/prisma-audit-log.repository.js';
import { CompanyAuthService } from './company-auth/company-auth.service.js';
import { PrismaPublicCatalogRepository } from './catalog/prisma-public-catalog.repository.js';
import {
  PUBLIC_CATALOG_REPOSITORY,
  type PublicCatalogRepository,
} from './catalog/public-catalog.repository.js';
import { PublicCatalogService } from './catalog/public-catalog.service.js';
import { EnterpriseCatalogService } from './catalog/enterprise-catalog.service.js';
import {
  DenyEnterpriseCatalogViewerResolver,
  ENTERPRISE_CATALOG_VIEWER_RESOLVER,
  type EnterpriseCatalogViewerResolver,
} from './catalog/enterprise-catalog-viewer.resolver.js';
import { CategoryService } from './categories/category.service.js';
import { PrismaCategoryRepository } from './categories/prisma-category.repository.js';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from './categories/category.repository.js';
import { CategoryTemplateService } from './category-templates/category-template.service.js';
import { PrismaCategoryTemplateRepository } from './category-templates/prisma-category-template.repository.js';
import {
  CATEGORY_TEMPLATE_REPOSITORY,
  type CategoryTemplateRepository,
} from './category-templates/category-template.repository.js';
import { PrismaRegulatedCategoryRepository } from './regulated-categories/prisma-regulated-category.repository.js';
import {
  REGULATED_CATEGORY_REPOSITORY,
  type RegulatedCategoryRepository,
} from './regulated-categories/regulated-category.repository.js';
import { RegulatedCategoryService } from './regulated-categories/regulated-category.service.js';
import {
  COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
  DenyCompanyProductApprovalActorResolver,
  type CompanyProductApprovalActorResolver,
} from './company-product-approvals/company-product-approval.actor.js';
import { CompanyProductApprovalSessionActorResolver } from './company-product-approvals/company-product-approval-session-actor.resolver.js';
import { CompanyProductApprovalService } from './company-product-approvals/company-product-approval.service.js';
import {
  CompanyAuditSessionActorResolver,
  CompanyFunctionalAccountSessionActorResolver,
  CompanySupplierOnboardingSessionActorResolver,
} from './company-auth/company-session-actors.js';
import { CompanyFunctionalAccountService } from './company-functional-accounts/company-functional-account.service.js';
import { PrismaCompanyFunctionalAccountRepository } from './company-functional-accounts/prisma-company-functional-account.repository.js';
import {
  COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
  type CompanyFunctionalAccountRepository,
} from './company-functional-accounts/company-functional-account.repository.js';
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
import {
  DenySupplierInventoryActorResolver,
  SUPPLIER_INVENTORY_ACTOR_RESOLVER,
  type SupplierInventoryActorResolver,
} from './inventory/inventory.actor.js';
import { SupplierInventorySessionActorResolver } from './inventory/inventory-session-actor.resolver.js';
import { InventoryService } from './inventory/inventory.service.js';
import { PrismaInventoryRepository } from './inventory/prisma-inventory.repository.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from './inventory/inventory.repository.js';
import {
  DenyOrderActorResolver,
  ORDER_ACTOR_RESOLVER,
  type OrderActorResolver,
} from './orders/order.actor.js';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from './orders/order.repository.js';
import { OrderService } from './orders/order.service.js';
import { PrismaOrderRepository } from './orders/prisma-order.repository.js';
import {
  COMPANY_FINANCE_ACTOR_RESOLVER,
  DenyCompanyFinanceActorResolver,
  type CompanyFinanceActorResolver,
} from './enterprise-remittances/enterprise-remittance.actor.js';
import { CompanyFinanceSessionActorResolver } from './enterprise-remittances/company-finance-session-actor.resolver.js';
import {
  ENTERPRISE_REMITTANCE_REPOSITORY,
  type EnterpriseRemittanceRepository,
} from './enterprise-remittances/enterprise-remittance.repository.js';
import { EnterpriseRemittanceService } from './enterprise-remittances/enterprise-remittance.service.js';
import { PrismaEnterpriseRemittanceRepository } from './enterprise-remittances/prisma-enterprise-remittance.repository.js';
import { PaymentService } from './payments/payment.service.js';
import { PrismaPaymentRepository } from './payments/prisma-payment.repository.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from './payments/payment.repository.js';
import {
  UnavailableWechatPaymentAdapter,
  WECHAT_PAYMENT_ADAPTER,
  type WechatPaymentAdapter,
} from './payments/wechat-payment.adapter.js';
import { PrismaSingleMerchantRepository } from './merchant/prisma-single-merchant.repository.js';
import {
  SINGLE_MERCHANT_REPOSITORY,
  type SingleMerchantRepository,
} from './merchant/single-merchant.repository.js';
import { SingleMerchantService } from './merchant/single-merchant.service.js';
import { PrismaSensitiveApprovalRepository } from './sensitive-approval/prisma-sensitive-approval.repository.js';
import {
  SENSITIVE_APPROVAL_REPOSITORY,
  type SensitiveApprovalRepository,
} from './sensitive-approval/sensitive-approval.repository.js';
import { SensitiveApprovalService } from './sensitive-approval/sensitive-approval.service.js';
import { OPENAPI_CONTROLLERS } from './openapi/openapi-controller.registry.js';
import {
  SUPPLIER_AUTH_SESSION_CREDENTIAL,
  SupplierAuthService,
} from './supplier-auth/supplier-auth.service.js';
import { PrismaSupplierAuthRepository } from './supplier-auth/prisma-supplier-auth.repository.js';
import {
  SUPPLIER_AUTH_REPOSITORY,
  type SupplierAuthRepository,
} from './supplier-auth/supplier-auth.repository.js';
import {
  SUPPLIER_CREDENTIAL_VERIFIER,
  SUPPLIER_SECOND_VERIFIER,
  UnavailableSupplierCredentialVerifier,
  UnavailableSupplierSecondVerifier,
  type SupplierCredentialVerifier,
  type SupplierSecondVerifier,
} from './supplier-auth/supplier-auth.security.js';
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
import {
  DenySupplierProductActorResolver,
  SUPPLIER_PRODUCT_ACTOR_RESOLVER,
  type SupplierProductActorResolver,
} from './supplier-products/supplier-product.actor.js';
import { PrismaSupplierProductRepository } from './supplier-products/prisma-supplier-product.repository.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type SupplierProductRepository,
} from './supplier-products/supplier-product.repository.js';
import { SupplierProductService } from './supplier-products/supplier-product.service.js';
import { SupplierProductSessionActorResolver } from './supplier-products/supplier-product-session-actor.resolver.js';
import {
  DenySupplierPricingActorResolver,
  SUPPLIER_PRICING_ACTOR_RESOLVER,
  type SupplierPricingActorResolver,
} from './supplier-pricing/supplier-pricing.actor.js';
import { SupplierPricingService } from './supplier-pricing/supplier-pricing.service.js';
import { SupplierPricingSessionActorResolver } from './supplier-pricing/supplier-pricing-session-actor.resolver.js';
import { PriceChangeService } from './price-changes/price-change.service.js';
import { PrismaPriceChangeRepository } from './price-changes/prisma-price-change.repository.js';
import {
  PRICE_CHANGE_REPOSITORY,
  type PriceChangeRepository,
} from './price-changes/price-change.repository.js';
import {
  BullPriceEffectScheduler,
  PRICE_EFFECT_SCHEDULER,
  type PriceEffectScheduler,
} from './price-changes/price-effect.scheduler.js';

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
  readonly sensitiveApprovalRepository?: SensitiveApprovalRepository;
  readonly companyAuthRepository?: CompanyAuthRepository;
  readonly companyCredentialVerifier?: CompanyCredentialVerifier;
  readonly companySecondVerifier?: CompanySecondVerifier;
  readonly companyFunctionalAccountRepository?: CompanyFunctionalAccountRepository;
  readonly supplierAuthRepository?: SupplierAuthRepository;
  readonly supplierCredentialVerifier?: SupplierCredentialVerifier;
  readonly supplierSecondVerifier?: SupplierSecondVerifier;
  readonly supplierProductRepository?: SupplierProductRepository;
  readonly supplierProductActorResolver?: SupplierProductActorResolver;
  readonly supplierPricingActorResolver?: SupplierPricingActorResolver;
  readonly companyProductApprovalActorResolver?: CompanyProductApprovalActorResolver;
  readonly catalogRepository?: PublicCatalogRepository;
  readonly enterpriseCatalogViewerResolver?: EnterpriseCatalogViewerResolver;
  readonly categoryRepository?: CategoryRepository;
  readonly categoryTemplateRepository?: CategoryTemplateRepository;
  readonly regulatedCategoryRepository?: RegulatedCategoryRepository;
  readonly priceChangeRepository?: PriceChangeRepository;
  readonly priceEffectScheduler?: PriceEffectScheduler;
  readonly inventoryRepository?: InventoryRepository;
  readonly supplierInventoryActorResolver?: SupplierInventoryActorResolver;
  readonly orderRepository?: OrderRepository;
  readonly orderActorResolver?: OrderActorResolver;
  readonly enterpriseRemittanceRepository?: EnterpriseRemittanceRepository;
  readonly companyFinanceActorResolver?: CompanyFinanceActorResolver;
  readonly paymentRepository?: PaymentRepository;
  readonly wechatPaymentAdapter?: WechatPaymentAdapter;
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: RUNTIME_CONFIG, useValue: options.config },
      {
        provide: SUPPLIER_AUTH_SESSION_CREDENTIAL,
        useValue: options.config.supplierAuthSessionSigningKey,
      },
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
      AuditSessionActorResolver,
      PrismaSensitiveApprovalRepository,
      SensitiveApprovalService,
      PrismaCompanyAuthRepository,
      UnavailableCompanyCredentialVerifier,
      UnavailableCompanySecondVerifier,
      CompanyAuthService,
      CompanyAuditSessionActorResolver,
      CompanyFunctionalAccountSessionActorResolver,
      CompanySupplierOnboardingSessionActorResolver,
      PrismaCompanyFunctionalAccountRepository,
      CompanyFunctionalAccountService,
      PrismaSupplierAuthRepository,
      UnavailableSupplierCredentialVerifier,
      UnavailableSupplierSecondVerifier,
      SupplierAuthService,
      PrismaSupplierProductRepository,
      DenySupplierProductActorResolver,
      SupplierProductSessionActorResolver,
      SupplierProductService,
      DenySupplierPricingActorResolver,
      SupplierPricingSessionActorResolver,
      SupplierPricingService,
      PrismaPriceChangeRepository,
      PriceChangeService,
      PrismaInventoryRepository,
      PrismaOrderRepository,
      PrismaEnterpriseRemittanceRepository,
      PrismaPaymentRepository,
      UnavailableWechatPaymentAdapter,
      DenyOrderActorResolver,
      DenyCompanyFinanceActorResolver,
      CompanyFinanceSessionActorResolver,
      DenySupplierInventoryActorResolver,
      SupplierInventorySessionActorResolver,
      InventoryService,
      OrderService,
      EnterpriseRemittanceService,
      PaymentService,
      DenyCompanyProductApprovalActorResolver,
      CompanyProductApprovalSessionActorResolver,
      CompanyProductApprovalService,
      PrismaPublicCatalogRepository,
      PublicCatalogService,
      EnterpriseCatalogService,
      DenyEnterpriseCatalogViewerResolver,
      PrismaCategoryRepository,
      CategoryService,
      PrismaCategoryTemplateRepository,
      CategoryTemplateService,
      PrismaRegulatedCategoryRepository,
      RegulatedCategoryService,
      options.priceChangeRepository
        ? { provide: PRICE_CHANGE_REPOSITORY, useValue: options.priceChangeRepository }
        : { provide: PRICE_CHANGE_REPOSITORY, useExisting: PrismaPriceChangeRepository },
      options.priceEffectScheduler
        ? { provide: PRICE_EFFECT_SCHEDULER, useValue: options.priceEffectScheduler }
        : { provide: PRICE_EFFECT_SCHEDULER, useClass: BullPriceEffectScheduler },
      options.inventoryRepository
        ? { provide: INVENTORY_REPOSITORY, useValue: options.inventoryRepository }
        : { provide: INVENTORY_REPOSITORY, useExisting: PrismaInventoryRepository },
      options.orderRepository
        ? { provide: ORDER_REPOSITORY, useValue: options.orderRepository }
        : { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
      options.orderActorResolver
        ? { provide: ORDER_ACTOR_RESOLVER, useValue: options.orderActorResolver }
        : { provide: ORDER_ACTOR_RESOLVER, useExisting: DenyOrderActorResolver },
      options.enterpriseRemittanceRepository
        ? { provide: ENTERPRISE_REMITTANCE_REPOSITORY, useValue: options.enterpriseRemittanceRepository }
        : { provide: ENTERPRISE_REMITTANCE_REPOSITORY, useExisting: PrismaEnterpriseRemittanceRepository },
      options.companyFinanceActorResolver
        ? { provide: COMPANY_FINANCE_ACTOR_RESOLVER, useValue: options.companyFinanceActorResolver }
        : { provide: COMPANY_FINANCE_ACTOR_RESOLVER, useExisting: CompanyFinanceSessionActorResolver },
      options.paymentRepository
        ? { provide: PAYMENT_REPOSITORY, useValue: options.paymentRepository }
        : { provide: PAYMENT_REPOSITORY, useExisting: PrismaPaymentRepository },
      options.wechatPaymentAdapter
        ? { provide: WECHAT_PAYMENT_ADAPTER, useValue: options.wechatPaymentAdapter }
        : { provide: WECHAT_PAYMENT_ADAPTER, useExisting: UnavailableWechatPaymentAdapter },
      options.supplierInventoryActorResolver
        ? { provide: SUPPLIER_INVENTORY_ACTOR_RESOLVER, useValue: options.supplierInventoryActorResolver }
        : { provide: SUPPLIER_INVENTORY_ACTOR_RESOLVER, useExisting: SupplierInventorySessionActorResolver },
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
            useExisting: CompanySupplierOnboardingSessionActorResolver,
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
            useExisting: CompanyFunctionalAccountSessionActorResolver,
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
        : {
            provide: AUDIT_ACTOR_RESOLVER,
            useExisting: AuditSessionActorResolver,
          },
      options.sensitiveApprovalRepository
        ? {
            provide: SENSITIVE_APPROVAL_REPOSITORY,
            useValue: options.sensitiveApprovalRepository,
          }
        : {
            provide: SENSITIVE_APPROVAL_REPOSITORY,
            useExisting: PrismaSensitiveApprovalRepository,
          },
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
      options.companyFunctionalAccountRepository
        ? {
            provide: COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
            useValue: options.companyFunctionalAccountRepository,
          }
        : {
            provide: COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
            useExisting: PrismaCompanyFunctionalAccountRepository,
          },
      options.supplierAuthRepository
        ? { provide: SUPPLIER_AUTH_REPOSITORY, useValue: options.supplierAuthRepository }
        : { provide: SUPPLIER_AUTH_REPOSITORY, useExisting: PrismaSupplierAuthRepository },
      options.supplierCredentialVerifier
        ? {
            provide: SUPPLIER_CREDENTIAL_VERIFIER,
            useValue: options.supplierCredentialVerifier,
          }
        : {
            provide: SUPPLIER_CREDENTIAL_VERIFIER,
            useExisting: UnavailableSupplierCredentialVerifier,
          },
      options.supplierSecondVerifier
        ? { provide: SUPPLIER_SECOND_VERIFIER, useValue: options.supplierSecondVerifier }
        : {
            provide: SUPPLIER_SECOND_VERIFIER,
            useExisting: UnavailableSupplierSecondVerifier,
          },
      options.supplierProductRepository
        ? {
            provide: SUPPLIER_PRODUCT_REPOSITORY,
            useValue: options.supplierProductRepository,
          }
        : {
            provide: SUPPLIER_PRODUCT_REPOSITORY,
            useExisting: PrismaSupplierProductRepository,
          },
      options.supplierProductActorResolver
        ? {
            provide: SUPPLIER_PRODUCT_ACTOR_RESOLVER,
            useValue: options.supplierProductActorResolver,
          }
        : {
            provide: SUPPLIER_PRODUCT_ACTOR_RESOLVER,
            useExisting: SupplierProductSessionActorResolver,
          },
      options.supplierPricingActorResolver
        ? {
            provide: SUPPLIER_PRICING_ACTOR_RESOLVER,
            useValue: options.supplierPricingActorResolver,
          }
        : {
            provide: SUPPLIER_PRICING_ACTOR_RESOLVER,
            useExisting: SupplierPricingSessionActorResolver,
          },
      options.companyProductApprovalActorResolver
        ? {
            provide: COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
            useValue: options.companyProductApprovalActorResolver,
          }
        : {
            provide: COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
            useExisting: CompanyProductApprovalSessionActorResolver,
          },
      options.catalogRepository
        ? {
            provide: PUBLIC_CATALOG_REPOSITORY,
            useValue: options.catalogRepository,
          }
        : {
            provide: PUBLIC_CATALOG_REPOSITORY,
            useExisting: PrismaPublicCatalogRepository,
          },
      options.enterpriseCatalogViewerResolver
        ? {
            provide: ENTERPRISE_CATALOG_VIEWER_RESOLVER,
            useValue: options.enterpriseCatalogViewerResolver,
          }
        : {
            provide: ENTERPRISE_CATALOG_VIEWER_RESOLVER,
            useExisting: DenyEnterpriseCatalogViewerResolver,
          },
      options.categoryRepository
        ? {
            provide: CATEGORY_REPOSITORY,
            useValue: options.categoryRepository,
          }
        : {
            provide: CATEGORY_REPOSITORY,
            useExisting: PrismaCategoryRepository,
          },
      options.categoryTemplateRepository
        ? {
            provide: CATEGORY_TEMPLATE_REPOSITORY,
            useValue: options.categoryTemplateRepository,
          }
        : {
            provide: CATEGORY_TEMPLATE_REPOSITORY,
            useExisting: PrismaCategoryTemplateRepository,
          },
      options.regulatedCategoryRepository
        ? {
            provide: REGULATED_CATEGORY_REPOSITORY,
            useValue: options.regulatedCategoryRepository,
          }
        : {
            provide: REGULATED_CATEGORY_REPOSITORY,
            useExisting: PrismaRegulatedCategoryRepository,
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
