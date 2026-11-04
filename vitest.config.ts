import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 5 s is too tight for component tests when the machine is busy (a TC-CHAT-008 run timed out under load)
const test = { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], testTimeout: 15_000, hookTimeout: 15_000 };

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    maxWorkers: 4, // more forks than this made workers miss their start timeout on this machine
    projects: [
      { extends: true, test: { ...test, name: "unit", include: ["src/**/*.unit.test.{ts,tsx}"] } },
      {
        extends: true,
        // one file at a time: the 5,000-chat timing test (TC-NFR-005) failed once with a 4.5 s outlier
        // while other integration files were using the same disk
        test: { ...test, name: "integration", include: ["src/**/*.integration.test.{ts,tsx}"], fileParallelism: false },
      },
    ],
  },
});
