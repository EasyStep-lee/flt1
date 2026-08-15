import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import { siteOrigin } from '../public-content';
import './globals.css';

export const metadata: Metadata = {
  description: '福礼团企业福利、供应链服务与企业采购门户。',
  metadataBase: siteOrigin,
  title: {
    default: '福礼团企业门户',
    template: '%s｜福礼团企业门户',
  },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
