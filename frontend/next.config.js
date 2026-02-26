/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "193-42-125-114.sslip.io",
        "toufopahilo.beget.app",
        "localhost:3000",
        "localhost:3001",
      ],
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
