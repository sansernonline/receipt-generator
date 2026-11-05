// usage: node test/e2e/verify.mjs <feature> — start app on a free port, run checks, always stop app.
// VERIFY_START_CMD overrides the start command (used to test the "app will not start" path).
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { features } from "./features.mjs";

const STARTUP_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 15_000;
const feature = process.argv[2];
const checks = Object.hasOwn(features, feature) ? features[feature] : [];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

function stop(app) {
  if (app.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"]);
  else app.kill("SIGKILL");
}

async function waitUntilReady(url, app) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline && app.exitCode === null) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function runCheck(base, check) {
  const res = await fetch(base + check.path, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = await res.text();
  const wantStatus = check.status ?? 200;
  if (res.status !== wantStatus) return `status ${res.status}, expected ${wantStatus}`;
  const missing = (check.includes ?? []).find((text) => !body.includes(text));
  return missing === undefined ? null : `text not found: ${missing}`;
}

if (!feature) fail("usage: verify.mjs <feature>");
if (!Object.hasOwn(features, feature)) fail(`unknown feature "${feature}" (known: ${Object.keys(features).join(", ")})`);
if (checks.length === 0) fail(`feature "${feature}" has 0 checks`);

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const startCmd = process.env.VERIFY_START_CMD ?? `npx next dev -H 127.0.0.1 -p ${port}`;
const app = spawn(startCmd, { shell: true, stdio: "ignore", env: { ...process.env, PORT: String(port), NEXT_DIST_DIR: ".next-verify" } });
let failures = 0;

try {
  if (!(await waitUntilReady(base, app))) {
    stop(app); // process.exit skips finally
    fail(`app did not start at ${base} within ${STARTUP_TIMEOUT_MS / 1000}s`);
  }
  console.log(`app up at ${base}`);
  for (const check of checks) {
    const problem = await runCheck(base, check).catch((e) => `request error: ${e.message}`);
    console.log(problem ? `FAIL ${check.name} — ${problem}` : `PASS ${check.name}`);
    if (problem) failures++;
  }
} finally {
  stop(app);
}
console.log(`${checks.length - failures}/${checks.length} passed`);
process.exit(failures === 0 ? 0 : 1);
