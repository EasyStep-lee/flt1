import type { MetadataRoute } from 'next';

import { siteOrigin } from '../public-content';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: '/',
      disallow: ['/enterprise/', '/company-admin/', '/supplier/'],
      userAgent: '*',
    },
    sitemap: new URL('/sitemap.xml', siteOrigin).href,
  };
}
