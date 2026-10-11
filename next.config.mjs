/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true
  },
  experimental: {
    largePageDataBytes: 8 * 1024 * 1024
  }
};
if (isStatic) {
  nextConfig.output = 'export';
}

export default nextConfig;
