import type { ReactNode } from 'react';

import { PublicSiteFrame } from '../../public-components';

export default function PublicLayout({ children }: { readonly children: ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
