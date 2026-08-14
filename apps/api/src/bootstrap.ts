import 'reflect-metadata';

import type { INestApplication, LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { AuditActorResolver } from './audit/audit-log.actor.js';
import type { AuditLogRepository } from './audit/audit-log.repository.js';
import type { CompanyAuthRepository } from './company-auth/company-auth.repository.js';
import type {
  CompanyCredentialVerifier,
  CompanySecondVerifier,
} from './company-auth/company-auth.security.js';
import type { CompanyFunctionalAccountRepository } from './company-functional-accounts/company-functional-account.repository.js';
import type { CompanyProductApprovalActorResolver } from './company-product-approvals/company-product-approval.actor.js';
import type { PublicCatalogRepository } from './catalog/public-catalog.repository.js';
import type { EnterpriseCatalogViewerResolver } from './catalog/enterprise-catalog-viewer.resolver.js';
import type { CategoryRepository } from './categories/category.repository.js';
import type { CategoryTemplateRepository } from './category-templates/category-template.repository.js';
import type { RegulatedCategoryRepository } from './regulated-categories/regulated-category.repository.js';

import { AppModule } from './app.module.js';
import {
  loadRuntimeConfig,
  type RuntimeConfig,
} from './config/runtime-config.js';
import { FoundationExceptionFilter } from './http/foundation-exception.filter.js';
import { requestIdMiddleware } from './http/request-id.middleware.js';
import type { InfrastructureProbe } from './infrastructure/probe.js';
import type { SupplierInventoryActorResolver } from './inventory/inventory.actor.js';
import type { InventoryRepository } from './inventory/inventory.repository.js';
import type { OrderActorResolver } from './orders/order.actor.js';
import type { OrderRepository } from './orders/order.repository.js';
import type { CompanyFinanceActorResolver } from './enterprise-remittances/enterprise-remittance.actor.js';
import type { EnterpriseRemittanceRepository } from './enterprise-remittances/enterprise-remittance.repository.js';
import type { PaymentRepository } from './payments/payment.repository.js';
import type { WechatPaymentAdapter } from './payments/wechat-payment.adapter.js';
import type { RefundActorResolver } from './refunds/refund.actor.js';
import type { RefundRepository } from './refunds/refund.repository.js';
import type {
  WelfareRefundAdapter,
  WechatRefundAdapter,
} from './refunds/refund.adapter.js';
import { SafeJsonLogger } from './logging/safe-json.logger.js';
import type { SingleMerchantRepository } from './merchant/single-merchant.repository.js';
import type { SensitiveApprovalRepository } from './sensitive-approval/sensitive-approval.repository.js';
import type { SupplierAuthRepository } from './supplier-auth/supplier-auth.repository.js';
import type {
  SupplierCredentialVerifier,
  SupplierSecondVerifier,
} from './supplier-auth/supplier-auth.security.js';
import type { FunctionalAccountActorResolver } from './supplier-functional-accounts/supplier-functional-account.actor.js';
import type { SupplierFunctionalAccountRepository } from './supplier-functional-accounts/supplier-functional-account.repository.js';
import type {
  FunctionalAccountAuditSink,
  FunctionalAccountSecondVerifier,
} from './supplier-functional-accounts/supplier-functional-account.security.js';
import type { SupplierOnboardingActorResolver } from './supplier-onboarding/supplier-onboarding.actor.js';
import type { SupplierOnboardingRepository } from './supplier-onboarding/supplier-onboarding.repository.js';
import type { SupplierRegistrationVerifier } from './supplier-onboarding/supplier-registration.verifier.js';
import type { SupplierProductActorResolver } from './supplier-products/supplier-product.actor.js';
import type { SupplierProductRepository } from './supplier-products/supplier-product.repository.js';
import type { SupplierPricingActorResolver } from './supplier-pricing/supplier-pricing.actor.js';
import type { PriceChangeRepository } from './price-changes/price-change.repository.js';
import { InMemoryPriceChangeRepository } from './price-changes/in-memory-price-change.repository.js';
import {
  InMemoryPriceEffectScheduler,
  type PriceEffectScheduler,
} from './price-changes/price-effect.scheduler.js';

type Environment = Readonly<Record<string, string | undefined>>;

export interface CreateApplicationOptions {
  readonly env?: Environment;
  readonly config?: RuntimeConfig;
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
  readonly refundRepository?: RefundRepository;
  readonly refundActorResolver?: RefundActorResolver;
  readonly welfareRefundAdapter?: WelfareRefundAdapter;
  readonly wechatRefundAdapter?: WechatRefundAdapter;
  readonly logger?: LoggerService | false;
}

export const createApplication = async (
  options: CreateApplicationOptions = {},
): Promise<INestApplication> => {
  const config = options.config ?? loadRuntimeConfig(options.env ?? process.env);
  const fallbackPriceChangeRepository =
    options.priceChangeRepository ??
    (options.probes ? new InMemoryPriceChangeRepository() : undefined);
  const fallbackPriceEffectScheduler =
    options.priceEffectScheduler ??
    (options.probes && fallbackPriceChangeRepository
      ? new InMemoryPriceEffectScheduler(fallbackPriceChangeRepository)
      : undefined);
  const moduleOptions = {
    config,
    ...(options.probes ? { probes: options.probes } : {}),
    ...(options.merchantRepository
      ? { merchantRepository: options.merchantRepository }
      : {}),
    ...(options.supplierOnboardingRepository
      ? { supplierOnboardingRepository: options.supplierOnboardingRepository }
      : {}),
    ...(options.supplierOnboardingActorResolver
      ? { supplierOnboardingActorResolver: options.supplierOnboardingActorResolver }
      : {}),
    ...(options.supplierRegistrationVerifier
      ? { supplierRegistrationVerifier: options.supplierRegistrationVerifier }
      : {}),
    ...(options.functionalAccountRepository
      ? { functionalAccountRepository: options.functionalAccountRepository }
      : {}),
    ...(options.functionalAccountActorResolver
      ? { functionalAccountActorResolver: options.functionalAccountActorResolver }
      : {}),
    ...(options.functionalAccountSecondVerifier
      ? { functionalAccountSecondVerifier: options.functionalAccountSecondVerifier }
      : {}),
    ...(options.functionalAccountAuditSink
      ? { functionalAccountAuditSink: options.functionalAccountAuditSink }
      : {}),
    ...(options.auditLogRepository
      ? { auditLogRepository: options.auditLogRepository }
      : {}),
    ...(options.auditActorResolver
      ? { auditActorResolver: options.auditActorResolver }
      : {}),
    ...(options.sensitiveApprovalRepository
      ? { sensitiveApprovalRepository: options.sensitiveApprovalRepository }
      : {}),
    ...(options.companyAuthRepository
      ? { companyAuthRepository: options.companyAuthRepository }
      : {}),
    ...(options.companyCredentialVerifier
      ? { companyCredentialVerifier: options.companyCredentialVerifier }
      : {}),
    ...(options.companySecondVerifier
      ? { companySecondVerifier: options.companySecondVerifier }
      : {}),
    ...(options.companyFunctionalAccountRepository
      ? {
          companyFunctionalAccountRepository:
            options.companyFunctionalAccountRepository,
        }
      : {}),
    ...(options.supplierAuthRepository
      ? { supplierAuthRepository: options.supplierAuthRepository }
      : {}),
    ...(options.supplierCredentialVerifier
      ? { supplierCredentialVerifier: options.supplierCredentialVerifier }
      : {}),
    ...(options.supplierSecondVerifier
      ? { supplierSecondVerifier: options.supplierSecondVerifier }
      : {}),
    ...(options.supplierProductRepository
      ? { supplierProductRepository: options.supplierProductRepository }
      : {}),
    ...(options.supplierProductActorResolver
      ? { supplierProductActorResolver: options.supplierProductActorResolver }
      : {}),
    ...(options.supplierPricingActorResolver
      ? { supplierPricingActorResolver: options.supplierPricingActorResolver }
      : {}),
    ...(options.companyProductApprovalActorResolver
      ? {
          companyProductApprovalActorResolver:
            options.companyProductApprovalActorResolver,
        }
      : {}),
    ...(options.catalogRepository
      ? { catalogRepository: options.catalogRepository }
      : {}),
    ...(options.enterpriseCatalogViewerResolver
      ? { enterpriseCatalogViewerResolver: options.enterpriseCatalogViewerResolver }
      : {}),
    ...(options.categoryRepository
      ? { categoryRepository: options.categoryRepository }
      : {}),
    ...(options.categoryTemplateRepository
      ? { categoryTemplateRepository: options.categoryTemplateRepository }
      : {}),
    ...(options.regulatedCategoryRepository
      ? { regulatedCategoryRepository: options.regulatedCategoryRepository }
      : {}),
    ...(fallbackPriceChangeRepository
      ? { priceChangeRepository: fallbackPriceChangeRepository }
      : {}),
    ...(fallbackPriceEffectScheduler
      ? { priceEffectScheduler: fallbackPriceEffectScheduler }
      : {}),
    ...(options.inventoryRepository
      ? { inventoryRepository: options.inventoryRepository }
      : {}),
    ...(options.supplierInventoryActorResolver
      ? { supplierInventoryActorResolver: options.supplierInventoryActorResolver }
      : {}),
    ...(options.orderRepository
      ? { orderRepository: options.orderRepository }
      : {}),
    ...(options.orderActorResolver
      ? { orderActorResolver: options.orderActorResolver }
      : {}),
    ...(options.enterpriseRemittanceRepository
      ? { enterpriseRemittanceRepository: options.enterpriseRemittanceRepository }
      : {}),
    ...(options.companyFinanceActorResolver
      ? { companyFinanceActorResolver: options.companyFinanceActorResolver }
      : {}),
    ...(options.paymentRepository
      ? { paymentRepository: options.paymentRepository }
      : {}),
    ...(options.wechatPaymentAdapter
      ? { wechatPaymentAdapter: options.wechatPaymentAdapter }
      : {}),
    ...(options.refundRepository
      ? { refundRepository: options.refundRepository }
      : {}),
    ...(options.refundActorResolver
      ? { refundActorResolver: options.refundActorResolver }
      : {}),
    ...(options.welfareRefundAdapter
      ? { welfareRefundAdapter: options.welfareRefundAdapter }
      : {}),
    ...(options.wechatRefundAdapter
      ? { wechatRefundAdapter: options.wechatRefundAdapter }
      : {}),
  };
  const logger = options.logger === false ? false : options.logger ?? new SafeJsonLogger();
  const app = await NestFactory.create(AppModule.register(moduleOptions), {
    abortOnError: true,
    logger,
  });
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new FoundationExceptionFilter());
  return app;
};
