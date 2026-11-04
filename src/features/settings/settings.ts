import { readFileSync } from "node:fs";
import type { VatMode, VatSetting } from "../totals/types";

export type Settings = { defaultVatRate: number };

// Location is not fixed by the SRS; PM2 sets BILLGEN_CONFIG (ARCH 6.3), else the shipped file.
const DEFAULT_CONFIG_PATH = "config/billgen.config.json";

// simple: 0..100 is our own bound, the SRS gives none (รอยืนยัน)
export function parseSettings(raw: unknown): Settings {
  const rate = (raw as { defaultVatRate?: unknown } | null)?.defaultVatRate;
  if (typeof rate !== "number" || !(rate >= 0 && rate <= 100)) {
    throw new Error("defaultVatRate must be a number from 0 to 100");
  }
  return { defaultVatRate: rate };
}

export function loadSettings(path = process.env.BILLGEN_CONFIG ?? DEFAULT_CONFIG_PATH): Settings {
  return parseSettings(JSON.parse(readFileSync(path, "utf8")));
}

/** Copy the rate into the bill: later config changes never touch existing bills. */
export function newBillVat(settings: Settings, mode: VatMode): VatSetting {
  return { mode, rate: settings.defaultVatRate };
}
