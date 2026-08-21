import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PUBLIC_DISPLAY_NAME } from '../../public-content';

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function PrivateEnterpriseLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="private-enterprise-shell" data-shell-id="portal-private-navigation-shell">
      <header className="private-enterprise-header">
        <Link aria-label="福礼团企业门户公开首页" className="brand" href="/">
          <span className="brand__mark">福</span>
          <span>{PUBLIC_DISPLAY_NAME}企业采购</span>
        </Link>
        <nav aria-label="企业采购导航" className="private-enterprise-nav">
          <Link href="/enterprise/procurement/products">企业采购货架</Link>
          <Link href="/enterprise/procurement/cart">企业采购车</Link>
          <Link href="/enterprise/workspace">企业工作台</Link>
        </nav>
        <Link className="text-link" href="/contact">
          联系客服
        </Link>
      </header>
      {children}
    </div>
  );
}
