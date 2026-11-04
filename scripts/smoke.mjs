// build standalone → start on 127.0.0.1 → GET / must be 200 → stop
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";

const url = "http://127.0.0.1:3200";
const build = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });

const server = spawn("node", [".next/standalone/server.js"], {
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3200" },
  stdio: "inherit",
});

async function waitForOk() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url);
      return res.status;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return 0;
}

const status = await waitForOk();
server.kill();
console.log(`smoke: GET ${url} -> ${status}`);
process.exit(status === 200 ? 0 : 1);
