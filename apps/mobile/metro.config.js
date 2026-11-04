// Sentry가 소스맵에 디버그 ID를 넣어 앱 오류 위치를 원래 코드로 보여 준다(ADR-0018).
const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// 화면 녹화(replay)는 쓰지 않으므로 번들에서 뺀다.
const config = getSentryExpoConfig(__dirname, { includeWebReplay: false });
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;

// three.js는 require로 부르면 Node 전용 판(three.cjs)이 골라지는데, 그 판은 앱에 없는 process.emitWarning을 불러
// 3D 화면을 불러오는 순간 오류가 난다. 앱에서는 늘 모듈판(three.module.js)을 쓴다.
const defaultResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "three") {
      return { type: "sourceFile", filePath: path.join(__dirname, "node_modules", "three", "build", "three.module.js") };
    }
    return defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  }
};

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
