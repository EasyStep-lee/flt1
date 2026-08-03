import { createWebApiClient } from '@fulishe/web-api-client';

export const createPortalWebApiClient = (baseUrl: string) =>
  createWebApiClient({ baseUrl });
