import { createWebApiClient } from '@fulishe/web-api-client';

export const createCompanyAdminApiClient = (baseUrl: string) =>
  createWebApiClient({ baseUrl, credentials: 'include' });
