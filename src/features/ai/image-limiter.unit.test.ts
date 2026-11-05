import { describe, expect, it } from "vitest";
import { createImageLimiter } from "./image-limiter";

const setup = () => {
  const clock = { ms: 0 };
  return { clock, limiter: createImageLimiter(() => clock.ms) };
};
const sec = (n: number) => n * 1000;

describe("createImageLimiter (20 pictures per minute, whole system)", () => {
  it("[TC-AI-027] lets 20 pass and stops the 21st in the same minute", () => {
    const { limiter } = setup();
    for (let i = 0; i < 20; i++) expect(limiter.take(1).ok).toBe(true);

    expect(limiter.take(1).ok).toBe(false);
  });

  it("[TC-AI-028] after the 60 second window the next picture passes", () => {
    const { clock, limiter } = setup();
    limiter.take(20);

    clock.ms = sec(61);

    expect(limiter.take(1).ok).toBe(true);
  });

  it("[TC-AI-028] a picture sent exactly at 60 seconds passes, one at 59.9 does not", () => {
    const { clock, limiter } = setup();
    limiter.take(20);

    clock.ms = sec(59.9);
    expect(limiter.take(1).ok).toBe(false);
    clock.ms = sec(60);
    expect(limiter.take(1).ok).toBe(true);
  });

  it("[TC-AI-034] the 21st picture at second 10 is told to wait 50 seconds", () => {
    const { clock, limiter } = setup();
    limiter.take(20);

    clock.ms = sec(10);

    expect(limiter.take(1)).toEqual({ ok: false, waitSeconds: 50 });
  });

  it("[TC-AI-035] the wait is always a whole number from 1 to 60", () => {
    const { clock, limiter } = setup();
    limiter.take(20);

    for (const at of [0, 0.4, 10, 59.5, 59.999]) {
      clock.ms = sec(at);
      const result = limiter.take(1);
      expect(result.ok).toBe(false);
      const wait = (result as { waitSeconds: number }).waitSeconds;
      expect(Number.isInteger(wait) && wait >= 1 && wait <= 60).toBe(true);
    }
  });

  it("a refused request uses up nothing", () => {
    const { limiter } = setup();
    limiter.take(15);

    expect(limiter.take(10).ok).toBe(false);
    expect(limiter.take(5).ok).toBe(true);
  });

  it("a request of several pictures waits until enough old ones have left the window", () => {
    const { clock, limiter } = setup();
    clock.ms = 0;
    limiter.take(10);
    clock.ms = sec(30);
    limiter.take(10);

    clock.ms = sec(40);

    expect(limiter.take(12)).toEqual({ ok: false, waitSeconds: 50 }); // needs 2 of the second batch to leave: 30 + 60 - 40
  });
});
