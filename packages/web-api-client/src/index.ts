import createClient from 'openapi-fetch';
import type { paths } from '@fulishe/contracts';

export type WebApiClientOptions = Parameters<typeof createClient<paths>>[0];
export type WebApiClient = ReturnType<typeof createClient<paths>>;

export const createWebApiClient = (
  options: WebApiClientOptions,
): WebApiClient => createClient<paths>(options);

export const createCookieBoundWebApiClient = (
  options: Omit<WebApiClientOptions, 'credentials'>,
): WebApiClient => createClient<paths>({ ...options, credentials: 'include' });
