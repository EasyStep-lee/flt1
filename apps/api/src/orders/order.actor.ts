import { Injectable } from '@nestjs/common';

export const ORDER_ACTOR_RESOLVER = Symbol('ORDER_ACTOR_RESOLVER');

export interface ConsumerOrderActor {
  readonly kind: 'CONSUMER';
  readonly companyId: string;
  readonly consumerUserId: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

export interface EnterpriseOrderActor {
  readonly kind: 'ENTERPRISE';
  readonly companyId: string;
  readonly enterpriseCustomerId: string;
  readonly enterpriseUserId: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
  readonly permissions: readonly string[];
}

export interface OrderActorResolver {
  resolveConsumer(cookieHeader: string | undefined): Promise<ConsumerOrderActor | null>;
  resolveEnterprise(cookieHeader: string | undefined): Promise<EnterpriseOrderActor | null>;
}

@Injectable()
export class DenyOrderActorResolver implements OrderActorResolver {
  async resolveConsumer(): Promise<null> {
    return null;
  }

  async resolveEnterprise(): Promise<null> {
    return null;
  }
}
