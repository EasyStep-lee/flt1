export const SESSION_NAMESPACE = 'fulishe:enterprise-portal';
export const SESSION_COOKIE_NAME = '__Host-fulishe-enterprise-portal';
export const LOGIN_ROUTE = '/enterprise/login';
export const PRIVATE_ROUTE_PREFIX = '/enterprise/';
export const PUBLIC_ENTRY_ROUTE = '/';

export const enterpriseSessionBoundary = Object.freeze({
  cookieName: SESSION_COOKIE_NAME,
  loginRoute: LOGIN_ROUTE,
  namespace: SESSION_NAMESPACE,
  privateRoutePrefix: PRIVATE_ROUTE_PREFIX,
  publicEntryRoute: PUBLIC_ENTRY_ROUTE,
});
