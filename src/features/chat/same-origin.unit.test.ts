import { describe, expect, test } from "vitest";
import { isAllowedOrigin } from "./same-origin";

const req = (host: string | null, origin: string | null) => {
  const headers = new Headers();
  if (host) headers.set("host", host);
  if (origin !== null) headers.set("origin", origin);
  return new Request("http://localhost/api/chats", { method: "POST", headers });
};

describe("isAllowedOrigin", () => {
  test.each([
    ["127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["localhost:3000", "http://localhost:3000"],
    ["localhost:3000", "http://127.0.0.1:3000"],
  ])("allows Host %s with Origin %s", (host, origin) => {
    expect(isAllowedOrigin(req(host, origin), {})).toBe(true);
  });

  test("allows an Origin listed in BILLGEN_ALLOWED_ORIGINS", () => {
    const env = { BILLGEN_ALLOWED_ORIGINS: "https://a.example, https://bill.example" };

    expect(isAllowedOrigin(req("internal:8080", "https://bill.example"), env)).toBe(true);
  });

  test.each([
    ["missing Origin", "localhost:3000", null],
    ["empty Origin", "localhost:3000", ""],
    ["null Origin", "localhost:3000", "null"],
    ["other port", "localhost:3000", "http://localhost:3001"],
    ["other host", "localhost:3000", "http://evil.com:3000"],
    ["port mixed with evil.com", "127.0.0.1:3555", "http://127.0.0.1:3555.evil.com"],
    ["forged Host", "evil.com", "http://evil.com"],
    ["https for local host", "localhost:3000", "https://localhost:3000"],
  ])("rejects %s", (_name, host, origin) => {
    expect(isAllowedOrigin(req(host, origin), {})).toBe(false);
  });
});
