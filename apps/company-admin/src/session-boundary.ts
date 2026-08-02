export const SESSION_NAMESPACE = 'fulishe:company-admin';
export const SESSION_COOKIE_NAME = '__Host-fulishe-company-admin';
export const LOGIN_ROUTE = '/company-admin/login';
export const ACCOUNT_SELECT_ROUTE = '/company-admin/select-workspace';
export const WORKSPACE_ROUTE_PREFIX = '/company-admin/workspaces/';

export const companySessionBoundary = Object.freeze({
  accountContext: 'single-functional-account',
  accountSelectRoute: ACCOUNT_SELECT_ROUTE,
  loginRoute: LOGIN_ROUTE,
  namespace: SESSION_NAMESPACE,
  workspaceRoutePrefix: WORKSPACE_ROUTE_PREFIX,
});
