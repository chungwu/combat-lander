/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  webpack(config, { isServer }) {
    config.experiments = { asyncWebAssembly: true };

    // https://github.com/vercel/next.js/issues/25852
    if (isServer) {
      config.output.webassemblyModuleFilename = "./../static/wasm/[modulehash].wasm";
    } else {
      config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
    }
    return config;
  }
};

export default nextConfig;
