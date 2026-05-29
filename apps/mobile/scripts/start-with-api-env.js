const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

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
  "device-nginx": {
    label: "local Docker/Nginx backend via USB device",
    preferIpv4Localhost: true,
    adbReversePorts: [
      [8080, 80],
      [8081, 8081]
    ],
    expoArgs: ["expo", "start", "--dev-client", "--localhost", "--clear"],
    env: {
      EXPO_PUBLIC_API_BASE_URL: "http://localhost:8080",
      EXPO_PUBLIC_API_BASE_URL_ANDROID: "http://localhost:8080",
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
  console.log("Usage: node scripts/start-with-api-env.js <local|local-nginx|device-nginx|prod>");
  console.log("");
  console.log("local       Android emulator -> http://10.0.2.2:8080");
  console.log("local-nginx Android emulator -> http://10.0.2.2");
  console.log("device-nginx Android physical device over USB -> http://localhost:8080");
  console.log("prod        Android/iOS -> https://api.writeloop.kr");
  process.exit(mode === "--help" || mode === "-h" ? 0 : 1);
}

const selected = modes[mode];
const expoArgs = selected.expoArgs ?? ["expo", "start", "--dev-client", "--lan", "--clear"];

function resolveAdbCommand() {
  const executable = process.platform === "win32" ? "adb.exe" : "adb";
  const candidateRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : ""
  ].filter(Boolean);

  for (const root of candidateRoots) {
    const candidate = join(root, "platform-tools", executable);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return executable;
}

function setupAdbReverse(ports) {
  if (!ports?.length) {
    return;
  }

  const adbCommand = resolveAdbCommand();
  ports.forEach((mapping) => {
    const [devicePort, hostPort] = Array.isArray(mapping) ? mapping : [mapping, mapping];
    const result = spawnSync(adbCommand, ["reverse", `tcp:${devicePort}`, `tcp:${hostPort}`], {
      stdio: "inherit",
      shell: false
    });

    if (result.status !== 0) {
      console.warn(
        `[WriteLoop mobile] adb reverse tcp:${devicePort} tcp:${hostPort} failed. ` +
          "Check USB debugging and device connection."
      );
    }
  });
}

setupAdbReverse(selected.adbReversePorts);

const env = {
  ...process.env,
  ...selected.env
};
if (selected.preferIpv4Localhost && !env.NODE_OPTIONS?.includes("--dns-result-order=ipv4first")) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --dns-result-order=ipv4first`.trim();
}
const npxCommand = process.platform === "win32" ? "npx" : "npx";

console.log(`[WriteLoop mobile] API mode: ${mode} (${selected.label})`);
console.log(`[WriteLoop mobile] Android API: ${selected.env.EXPO_PUBLIC_API_BASE_URL_ANDROID}`);

const child = spawn(
  npxCommand,
  expoArgs,
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
