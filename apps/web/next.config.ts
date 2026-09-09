import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false, reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }];
  },
};
export default nextConfig;
