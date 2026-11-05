import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, test } from "vitest";

const port = 3300;
const base = `http://127.0.0.1:${port}`;
let server: ChildProcess;

async function waitUntilUp() {
  for (let i = 0; i < 120; i++) {
    try {
      return await fetch(base);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("next dev did not start");
}

beforeAll(async () => {
  server = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    shell: true,
    stdio: "ignore",
    env: { ...process.env, NEXT_DIST_DIR: ".next-integration" }, // own build folder: another next dev may hold the lock of .next
  });
  await waitUntilUp();
}, 90_000);

afterAll(() => {
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill("SIGKILL");
});

test("[TC-CHAT-002] /edit returns 404 with a Thai not-found message and no stack trace", async () => {
  const res = await fetch(`${base}/edit`);
  const html = await res.text();

  expect(res.status).toBe(404);
  expect(html).toContain("ไม่พบหน้า");
  expect(html).not.toMatch(/\bat \S+ \(|\b[A-Za-z]:\\+\w|\/Users\/|\/home\//);
}, 60_000);
