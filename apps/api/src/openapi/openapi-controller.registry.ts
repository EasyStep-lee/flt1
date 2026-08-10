import { AuditLogController } from '../audit/audit-log.controller.js';
import { PublicCatalogController } from '../catalog/public-catalog.controller.js';
import { CompanyAuthController } from '../company-auth/company-auth.controller.js';
import {
  CompanyInitialPriceReviewController,
  CompanyProductMaterialReviewController,
} from '../company-product-approvals/company-product-approval.controller.js';
import { HealthController } from '../health/health.controller.js';
import { SingleMerchantController } from '../merchant/single-merchant.controller.js';
import { SensitiveApprovalController } from '../sensitive-approval/sensitive-approval.controller.js';
import { SupplierAuthController } from '../supplier-auth/supplier-auth.controller.js';
import { SupplierFunctionalAccountController } from '../supplier-functional-accounts/supplier-functional-account.controller.js';
import {
  CompanySupplierOnboardingController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
} from '../supplier-onboarding/supplier-onboarding.controller.js';
import { SupplierProductController } from '../supplier-products/supplier-product.controller.js';
import { SupplierPricingController } from '../supplier-pricing/supplier-pricing.controller.js';

export const OPENAPI_CONTROLLERS = Object.freeze([
  AuditLogController,
  PublicCatalogController,
  CompanyAuthController,
  CompanyProductMaterialReviewController,
  CompanyInitialPriceReviewController,
  HealthController,
  SingleMerchantController,
  SensitiveApprovalController,
  SupplierAuthController,
  SupplierFunctionalAccountController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
  CompanySupplierOnboardingController,
  SupplierProductController,
  SupplierPricingController,
]);
