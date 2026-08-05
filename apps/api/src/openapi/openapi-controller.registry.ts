import { HealthController } from '../health/health.controller.js';
import { SingleMerchantController } from '../merchant/single-merchant.controller.js';
import {
  CompanySupplierOnboardingController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
} from '../supplier-onboarding/supplier-onboarding.controller.js';

export const OPENAPI_CONTROLLERS = Object.freeze([
  HealthController,
  SingleMerchantController,
  SupplierRegistrationController,
  SupplierSelfServiceController,
  CompanySupplierOnboardingController,
]);
