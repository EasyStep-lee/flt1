import { createCookieBoundWebApiClient } from '@fulishe/web-api-client';

export const createSupplierPortalApiClient = (baseUrl: string) =>
  createCookieBoundWebApiClient({ baseUrl });
