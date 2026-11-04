import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calcTotals } from "../totals/calc-totals";
import { loadSettings, newBillVat, parseSettings } from "./settings";

const writeConfig = (text: string) => {
  const file = join(mkdtempSync(join(tmpdir(), "billgen-")), "c.json");
  writeFileSync(file, text);
  return file;
};

describe("settings", () => {
  it("[TC-TOT-019] shipped config gives a new exclusive bill 7%", () => {
    const vat = newBillVat(loadSettings(), "exclusive");

    expect(vat).toEqual({ mode: "exclusive", rate: 7 });
  });

  it("[TC-TOT-020] config 10 gives new inclusive bill 10%", () => {
    const settings = loadSettings(writeConfig('{"defaultVatRate":10}'));

    expect(newBillVat(settings, "inclusive").rate).toBe(10);
  });

  it("[TC-TOT-020] mode none still computes 0 vat on 100 even when rate is 10", () => {
    const vat = newBillVat(parseSettings({ defaultVatRate: 10 }), "none");

    const totals = calcTotals({ lines: [{ quantity: 1, unitPrice: 100 }], vat });

    expect([totals.vat, totals.net]).toEqual([0, 100]);
  });

  it("[TC-TOT-020] an existing bill keeps its own rate after the setting changes", () => {
    const oldBill = newBillVat(parseSettings({ defaultVatRate: 7 }), "exclusive");

    newBillVat(parseSettings({ defaultVatRate: 10 }), "exclusive");

    expect(oldBill.rate).toBe(7);
  });

  it("[TC-NFR-030] config 8 gives 100.00 exclusive -> vat 8.00 net 108.00", () => {
    const vat = newBillVat(parseSettings({ defaultVatRate: 8 }), "exclusive");

    const totals = calcTotals({ lines: [{ quantity: 1, unitPrice: 100 }], vat });

    expect([totals.vat, totals.net]).toEqual([8, 108]);
  });

  it.each([["7"], [-1], [101], [NaN], [null], [undefined]])(
    "[TC-NFR-030] rejects defaultVatRate %s",
    (rate) => {
      expect(() => parseSettings({ defaultVatRate: rate })).toThrow(/defaultVatRate/);
    },
  );

  it("rejects a config that is not an object", () => {
    expect(() => parseSettings(null)).toThrow(/defaultVatRate/);
  });

  it("rejects a config file that is not JSON", () => {
    expect(() => loadSettings(writeConfig("{oops"))).toThrow();
  });

  it.todo("[TC-TOT-019] integration: new-bill form shows 7% for a header with exclusive mode (needs UI + store)");
  it.todo("[TC-TOT-020] integration: restart the server after editing the config, then create bills (needs running app)");
  it.todo("[TC-NFR-030] integration: change config to 8, restart process, 0 source files changed, under 10 minutes (needs deploy + timing)");
  it.todo("range 0..100 is our choice, SRS gives none (รอยืนยัน)");
});
