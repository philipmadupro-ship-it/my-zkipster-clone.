/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@google-cloud/firestore',
      '@grpc/grpc-js',
      'google-gax',
      'qrcode',
    ],
  },
};

module.exports = nextConfig;
