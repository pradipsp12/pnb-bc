/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: false, // needed for file uploads
  },
};

module.exports = nextConfig;
