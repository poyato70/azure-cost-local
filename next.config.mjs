/** Static React shell; APIs and credentials remain in the local Fastify service. */
export default {
  output: "export",
  images: { unoptimized: true },
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};
