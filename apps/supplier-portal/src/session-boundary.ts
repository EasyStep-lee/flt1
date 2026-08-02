export const SESSION_NAMESPACE = 'fulishe:supplier-portal';
export const SESSION_COOKIE_NAME = '__Host-fulishe-supplier-portal';
export const REGISTER_ROUTE = '/supplier/register';
export const LOGIN_ROUTE = '/supplier/login';
export const ACCOUNT_SELECT_ROUTE = '/supplier/select-workspace';
export const WORKSPACE_ROUTE_PREFIX = '/supplier/workspaces/';

export const supplierSessionBoundary = Object.freeze({
  accountContext: 'single-supplier-functional-account',
  accountSelectRoute: ACCOUNT_SELECT_ROUTE,
  loginRoute: LOGIN_ROUTE,
  namespace: SESSION_NAMESPACE,
  registerRoute: REGISTER_ROUTE,
  workspaceRoutePrefix: WORKSPACE_ROUTE_PREFIX,
});
