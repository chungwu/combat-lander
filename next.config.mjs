/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.experiments = { asyncWebAssembly: true }
    return config;
  }
};

export default nextConfig;
