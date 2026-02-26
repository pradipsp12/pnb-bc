/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: false, // needed for file uploads
  },
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
};

module.exports = nextConfig;
