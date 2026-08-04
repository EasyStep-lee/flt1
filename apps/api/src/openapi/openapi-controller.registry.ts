import { HealthController } from '../health/health.controller.js';
import { SingleMerchantController } from '../merchant/single-merchant.controller.js';

export const OPENAPI_CONTROLLERS = Object.freeze([
  HealthController,
  SingleMerchantController,
]);
