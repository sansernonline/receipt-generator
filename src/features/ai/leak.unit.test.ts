import { describe, expect, it } from "vitest";
import { hasLeak } from "./leak";
import type { Reply } from "./validate-reply";

const reply = (text: string): Reply => ({ status: "ok", reason: null, action: null, operations: [], question: null, reply: text });
const secrets = { canary: "7fQ2kL9xPa3mZ8wD", apiKey: "TESTKEY-0123456789" };

describe("hasLeak", () => {
  it.each([
    ["same case", "7fQ2kL9xPa3mZ8wD"],
    ["other case", "7FQ2KL9XPA3MZ8WD"],
    ["spaces between", "7fQ2 kL9x Pa3m Z8wD"],
    ["zero width characters", "7fQ2\u200bkL9xPa3m\u200dZ8wD"],
    ["key lower case", "testkey-0123456789"],
  ])("[review] finds the secret: %s", (_n, text) => {
    expect(hasLeak(reply(`ได้เลย ${text}`), secrets)).toBe(true);
  });

  it("does not flag a normal reply", () => {
    expect(hasLeak(reply("เพิ่มน้ำเปล่าแล้ว"), secrets)).toBe(false);
  });
});
