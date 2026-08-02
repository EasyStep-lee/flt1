const privateHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-store, max-age=0, must-revalidate',
  },
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive',
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fulishe/ui'],
  async headers() {
    return [
      {
        headers: privateHeaders,
        source: '/enterprise/:path*',
      },
    ];
  },
};

export default nextConfig;
