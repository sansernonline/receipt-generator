import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = 3100;
const dataDir = path.resolve("test-results", "e2e-data"); // fixed test folder, never the real data folder
if (!process.env.TEST_WORKER_INDEX) {
  // workers load this file too; only the runner may wipe the folder
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
}

export default defineConfig({
  testDir: "./e2e",
  workers: 1, // all tests share one data folder and one chat list; parallel tests would reorder each other's list
  timeout: 60_000, // first page load compiles on demand in next dev
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { BILLGEN_DATA_DIR: dataDir },
  },
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "edge", use: { channel: "msedge" } },
  ],
});
