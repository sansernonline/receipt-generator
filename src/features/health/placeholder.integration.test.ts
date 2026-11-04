import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

test("[placeholder-integration] reads back a file written to a temp data dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "billgen-"));
  await writeFile(join(dir, "x.json"), "{}");

  const content = await readFile(join(dir, "x.json"), "utf8");

  expect(content).toBe("{}");
  await rm(dir, { recursive: true });
});
