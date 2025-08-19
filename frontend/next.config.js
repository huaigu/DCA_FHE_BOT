const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Define global as window (similar to Vite's define)
    config.plugins.push(
      new webpack.DefinePlugin({
        global: 'window',
      })
    );

    return config;
  },
  transpilePackages: ["@fhevm/fhevm"],
};

module.exports = nextConfig;
