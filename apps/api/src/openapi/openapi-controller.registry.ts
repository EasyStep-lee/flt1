import { AuditLogController } from '../audit/audit-log.controller.js';
import { CompanyAuthController } from '../company-auth/company-auth.controller.js';
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

export const OPENAPI_CONTROLLERS = Object.freeze([
  AuditLogController,
  CompanyAuthController,
  HealthController,
  SingleMerchantController,
  SensitiveApprovalController,
  SupplierAuthController,
  SupplierFunctionalAccountController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
  CompanySupplierOnboardingController,
]);
