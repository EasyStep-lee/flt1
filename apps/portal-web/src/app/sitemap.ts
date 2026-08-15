import type { MetadataRoute } from 'next';

import { publicRoutes, siteOrigin } from '../public-content';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    lastModified: new Date('2026-08-02T00:00:00-04:00'),
    priority: route === '/' ? 1 : route.includes('/news/') || route.includes('/cases/') ? 0.6 : 0.8,
    url: new URL(route, siteOrigin).href,
  }));
}
