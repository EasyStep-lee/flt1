import { Injectable } from '@nestjs/common';

export const ENTERPRISE_CATALOG_VIEWER_RESOLVER = Symbol(
  'ENTERPRISE_CATALOG_VIEWER_RESOLVER',
);

export interface EnterpriseCatalogViewer {
  readonly enterpriseId: string;
  readonly status: 'ACTIVE';
}

export interface EnterpriseCatalogViewerResolver {
  resolve(cookieHeader: string | undefined): Promise<EnterpriseCatalogViewer | null>;
}

@Injectable()
export class DenyEnterpriseCatalogViewerResolver
  implements EnterpriseCatalogViewerResolver
{
  async resolve(_cookieHeader: string | undefined): Promise<null> {
    return null;
  }
}
