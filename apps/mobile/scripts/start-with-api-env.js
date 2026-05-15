const { spawn } = require("node:child_process");

const mode = process.argv[2] ?? "local";

const modes = {
  local: {
    label: "local Spring Boot backend",
    env: {
      EXPO_PUBLIC_API_BASE_URL: "http://localhost:8080",
      EXPO_PUBLIC_API_BASE_URL_ANDROID: "http://10.0.2.2:8080",
      EXPO_PUBLIC_API_BASE_URL_IOS: "http://localhost:8080"
    }
  },
  "local-nginx": {
    label: "local Docker/Nginx backend",
    env: {
      EXPO_PUBLIC_API_BASE_URL: "http://localhost",
      EXPO_PUBLIC_API_BASE_URL_ANDROID: "http://10.0.2.2",
      EXPO_PUBLIC_API_BASE_URL_IOS: "http://localhost"
    }
  },
  prod: {
    label: "production backend",
    env: {
      EXPO_PUBLIC_API_BASE_URL: "https://api.writeloop.kr",
      EXPO_PUBLIC_API_BASE_URL_ANDROID: "https://api.writeloop.kr",
      EXPO_PUBLIC_API_BASE_URL_IOS: "https://api.writeloop.kr"
    }
  }
};

if (mode === "--help" || mode === "-h" || !modes[mode]) {
  console.log("Usage: node scripts/start-with-api-env.js <local|local-nginx|prod>");
  console.log("");
  console.log("local       Android emulator -> http://10.0.2.2:8080");
  console.log("local-nginx Android emulator -> http://10.0.2.2");
  console.log("prod        Android/iOS -> https://api.writeloop.kr");
  process.exit(mode === "--help" || mode === "-h" ? 0 : 1);
}

const selected = modes[mode];
const env = {
  ...process.env,
  ...selected.env
};
const npxCommand = process.platform === "win32" ? "npx" : "npx";

console.log(`[WriteLoop mobile] API mode: ${mode} (${selected.label})`);
console.log(`[WriteLoop mobile] Android API: ${selected.env.EXPO_PUBLIC_API_BASE_URL_ANDROID}`);

const child = spawn(
  npxCommand,
  ["expo", "start", "--dev-client", "--lan", "--clear"],
  {
    stdio: "inherit",
    env,
    shell: process.platform === "win32"
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
