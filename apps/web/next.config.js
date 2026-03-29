/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@biopay/ui"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  },
};

module.exports = nextConfig;
