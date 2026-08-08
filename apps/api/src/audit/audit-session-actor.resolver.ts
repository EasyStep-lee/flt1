import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { SafeApiError } from '../http/api-error.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import type { AuditActor, AuditActorResolver } from './audit-log.actor.js';

const COMPANY_COOKIE = '__Host-fulishe-company-admin=';
const SUPPLIER_COOKIE = '__Host-fulishe-supplier-portal=';

@Injectable()
export class AuditSessionActorResolver implements AuditActorResolver {
  constructor(
    @Inject(CompanyAuthService)
    private readonly companyAuth: CompanyAuthService,
    @Inject(SupplierAuthService)
    private readonly supplierAuth: SupplierAuthService,
  ) {}

  async resolve(request: Request): Promise<AuditActor> {
    const cookies = request.headers.cookie ?? '';
    const hasCompany = cookies.includes(COMPANY_COOKIE);
    const hasSupplier = cookies.includes(SUPPLIER_COOKIE);
    if (hasCompany && hasSupplier) {
      throw new SafeApiError(
        409,
        'WORKSPACE_SESSION_CONFLICT',
        'Only one functional session may be active',
      );
    }
    if (hasSupplier) {
      const session = await this.supplierAuth.resolveActiveSession(cookies);
      if (
        session.accountTypeCode !== 'SUPPLIER_AUDIT' ||
        session.workspaceRoute !== '/supplier/workspaces/audit'
      ) {
        throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Supplier audit workspace is required');
      }
      return {
        ownerType: 'SUPPLIER',
        accountTypeCode: session.accountTypeCode,
        companyId: null,
        functionalAccountId: session.functionalAccountId,
        identityType: 'SUPPLIER_USER',
        identityId: session.userId,
        supplierId: session.supplierId,
        workspaceRoute: session.workspaceRoute,
        permissionCodes: [
          'audit_event.read',
          'sensitive_export.request',
        ],
      };
    }
    const session = await this.companyAuth.resolveActiveSession(cookies);
    if (
      session.accountTypeCode !== 'COMPANY_AUDIT' &&
      session.accountTypeCode !== 'COMPANY_SUPER_ADMIN'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Company audit workspace is required');
    }
    return {
      ownerType: 'COMPANY',
      accountTypeCode: session.accountTypeCode,
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityType: 'COMPANY_USER',
      identityId: session.userId,
      supplierId: null,
      workspaceRoute: session.workspaceRoute,
      permissionCodes:
        session.accountTypeCode === 'COMPANY_AUDIT'
          ? [
              'audit_event.read',
              'sensitive_export.request',
              'sensitive_export.review',
            ]
          : ['sensitive_export.review'],
    };
  }
}
