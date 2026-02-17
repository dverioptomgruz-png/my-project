/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['crispy-meme-q7j6vj7p5vxvfxgqp-3001.app.github.dev', 'localhost:3001'],
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;