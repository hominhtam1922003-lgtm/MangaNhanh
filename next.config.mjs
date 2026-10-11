/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true
  },
  experimental: {
    largePageDataBytes: 8 * 1024 * 1024
  },
  output: 'export'
};

export default nextConfig;
