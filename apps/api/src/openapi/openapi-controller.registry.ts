import { AuditLogController } from '../audit/audit-log.controller.js';
import { PublicCatalogController } from '../catalog/public-catalog.controller.js';
import { EnterpriseCatalogController } from '../catalog/enterprise-catalog.controller.js';
import { CategoryController } from '../categories/category.controller.js';
import { CategoryTemplateController } from '../category-templates/category-template.controller.js';
import { CompanyAuthController } from '../company-auth/company-auth.controller.js';
import {
  CompanyInitialPriceReviewController,
  CompanyProductMaterialReviewController,
} from '../company-product-approvals/company-product-approval.controller.js';
import { HealthController } from '../health/health.controller.js';
import { SingleMerchantController } from '../merchant/single-merchant.controller.js';
import { InventoryController } from '../inventory/inventory.controller.js';
import { SensitiveApprovalController } from '../sensitive-approval/sensitive-approval.controller.js';
import { RegulatedCategoryController } from '../regulated-categories/regulated-category.controller.js';
import { SupplierAuthController } from '../supplier-auth/supplier-auth.controller.js';
import { SupplierFunctionalAccountController } from '../supplier-functional-accounts/supplier-functional-account.controller.js';
import {
  CompanySupplierOnboardingController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
} from '../supplier-onboarding/supplier-onboarding.controller.js';
import { SupplierProductController } from '../supplier-products/supplier-product.controller.js';
import { SupplierPricingController } from '../supplier-pricing/supplier-pricing.controller.js';
import {
  CompanySupplyPriceReviewController,
  SupplierListedPricingController,
  SupplierSupplyPriceChangeController,
} from '../price-changes/price-change.controller.js';
import {
  ConsumerOrderController,
  EnterpriseOrderController,
} from '../orders/order.controller.js';
import {
  WechatPaymentNotificationController,
  WechatPrepayController,
} from '../payments/payment.controller.js';
import {
  CompanyEnterpriseRemittanceController,
  EnterpriseRemittanceController,
} from '../enterprise-remittances/enterprise-remittance.controller.js';

export const OPENAPI_CONTROLLERS = Object.freeze([
  AuditLogController,
  PublicCatalogController,
  EnterpriseCatalogController,
  RegulatedCategoryController,
  CategoryController,
  CategoryTemplateController,
  CompanyAuthController,
  CompanyProductMaterialReviewController,
  CompanyInitialPriceReviewController,
  HealthController,
  SingleMerchantController,
  InventoryController,
  SensitiveApprovalController,
  SupplierAuthController,
  SupplierFunctionalAccountController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
  CompanySupplierOnboardingController,
  SupplierProductController,
  SupplierPricingController,
  SupplierListedPricingController,
  SupplierSupplyPriceChangeController,
  CompanySupplyPriceReviewController,
  ConsumerOrderController,
  EnterpriseOrderController,
  EnterpriseRemittanceController,
  CompanyEnterpriseRemittanceController,
  WechatPrepayController,
  WechatPaymentNotificationController,
]);
