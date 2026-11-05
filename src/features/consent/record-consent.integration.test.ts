import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/consent/route";

const headers = { host: "localhost:3000", origin: "http://localhost:3000" };
let dataDir: string;
const logFile = () => path.join(dataDir, "consent-log.json");
const readLog = async () => JSON.parse(await fsp.readFile(logFile(), "utf8")) as object[];
const acknowledge = (over: Record<string, string> = {}) => POST(new Request("http://localhost/api/consent", { method: "POST", headers: { ...headers, ...over } }));

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-consent-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T05:00:00Z")); // 12:00 Asia/Bangkok
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test("[TC-NFR-020] before anyone accepts there is no record", async () => {
  await expect(fsp.access(logFile())).rejects.toThrow();
});

test("[TC-NFR-020] one acknowledgement adds one entry with the time and nothing else", async () => {
  const res = await acknowledge();

  expect(res.status).toBe(201);
  expect(await readLog()).toEqual([{ at: "2026-10-18T05:00:00.000Z" }]);
});

test("[TC-NFR-020] a second acknowledgement adds a second entry", async () => {
  await acknowledge();
  await acknowledge();

  expect(await readLog()).toHaveLength(2);
});

test("[TC-NFR-020] two acknowledgements at the same moment are both kept", async () => {
  await Promise.all([acknowledge(), acknowledge()]);

  expect(await readLog()).toHaveLength(2);
});

test("a request from another origin is refused and records nothing", async () => {
  const res = await acknowledge({ origin: "http://evil.example" });

  expect(res.status).toBe(403);
  await expect(fsp.access(logFile())).rejects.toThrow();
});
