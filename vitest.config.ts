import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const test = { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] };

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { ...test, name: "unit", include: ["src/**/*.unit.test.{ts,tsx}"] } },
      { extends: true, test: { ...test, name: "integration", include: ["src/**/*.integration.test.{ts,tsx}"] } },
    ],
  },
});
