import type { MetadataRoute } from 'next';

const shellOrigin = 'https://fulishe.example.invalid';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: '/',
      disallow: ['/enterprise/', '/company-admin/', '/supplier/'],
      userAgent: '*',
    },
    sitemap: `${shellOrigin}/sitemap.xml`,
  };
}
