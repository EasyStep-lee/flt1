import type { MetadataRoute } from 'next';

const shellOrigin = 'https://fulishe.example.invalid';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: 'weekly',
      lastModified: new Date('2026-08-02T00:00:00-04:00'),
      priority: 1,
      url: `${shellOrigin}/`,
    },
  ];
}
