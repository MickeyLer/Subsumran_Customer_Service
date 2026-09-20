/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure transpilation for packages that might use raw ES modules if needed
  transpilePackages: ['@line/liff'],
};

module.exports = nextConfig;
