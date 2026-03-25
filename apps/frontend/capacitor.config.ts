import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.writeloop.app",
  appName: "writeLoop",
  webDir: "out",
  server: {
    androidScheme: "http"
  }
};

export default config;
