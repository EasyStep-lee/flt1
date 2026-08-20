import { EnterpriseOrderWorkflow } from '../enterprise-order-workflow';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function EnterpriseCartPage() {
  return <EnterpriseOrderWorkflow mode="cart" />;
}
