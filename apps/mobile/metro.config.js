const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const enhancedMiddleware =
      typeof defaultEnhanceMiddleware === "function"
        ? defaultEnhanceMiddleware(middleware)
        : middleware;

    return (req, res, next) => {
      // Android's dev bundle downloader can fail to parse Metro's multipart
      // progress response in this setup. Fall back to a plain JS response.
      if (typeof req.headers.accept === "string" && req.headers.accept.includes("multipart/mixed")) {
        req.headers.accept = req.headers.accept
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value !== "multipart/mixed")
          .join(", ");
      }

      return enhancedMiddleware(req, res, next);
    };
  }
};

module.exports = config;
