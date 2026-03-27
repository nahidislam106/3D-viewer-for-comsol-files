/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glsl$/i,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
