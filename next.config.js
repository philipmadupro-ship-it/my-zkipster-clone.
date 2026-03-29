/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/firestore',
    '@grpc/grpc-js',
    'google-gax',
    'qrcode',
  ],
};

module.exports = nextConfig;
