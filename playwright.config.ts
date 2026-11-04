import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "edge", use: { channel: "msedge" } },
  ],
});
