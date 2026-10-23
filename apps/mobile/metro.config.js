// Sentry가 소스맵에 디버그 ID를 넣어 앱 오류 위치를 원래 코드로 보여 준다(ADR-0018).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// 화면 녹화(replay)는 쓰지 않으므로 번들에서 뺀다.
const config = getSentryExpoConfig(__dirname, { includeWebReplay: false });
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
