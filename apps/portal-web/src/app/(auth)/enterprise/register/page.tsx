import type { Metadata } from 'next';

import { EnterpriseRegistrationForm } from './registration-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export const metadata: Metadata = {
  title: '企业注册认证',
  description: '企业采购开户注册与主体认证。',
  robots: { follow: false, index: false },
};

export default function EnterpriseRegistrationPage() {
  return <EnterpriseRegistrationForm />;
}
