import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CustomerFacingCompanyRecord,
  SingleMerchantRepository,
} from './single-merchant.repository.js';

@Injectable()
export class PrismaSingleMerchantRepository implements SingleMerchantRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCustomerFacingCompanies(): Promise<readonly CustomerFacingCompanyRecord[]> {
    return this.prisma.company.findMany({
      orderBy: { id: 'asc' },
      select: {
        legalName: true,
        platformName: true,
        status: true,
      },
      take: 2,
    });
  }
}
