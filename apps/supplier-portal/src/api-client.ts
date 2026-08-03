import { createWebApiClient } from '@fulishe/web-api-client';

export const createSupplierPortalApiClient = (baseUrl: string) =>
  createWebApiClient({ baseUrl });
