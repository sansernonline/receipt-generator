export const IMAGE_LIMIT_PER_MINUTE = 20; // FR-AI-090: the free OCR quota
const WINDOW_MS = 60_000;

export type TakeResult = { ok: true } | { ok: false; waitSeconds: number };
export type ImageLimiter = { take: (count: number) => TakeResult };

// simple: the counter lives in this process's memory, so the limit is exact for one server process
// and a restart forgets it. Use a shared store if the app ever runs as several processes.
/** Sliding window: a picture counts for 60 seconds after it was taken (the window rule is not confirmed in the SRS). */
export function createImageLimiter(now: () => number = Date.now): ImageLimiter {
  let takenAt: number[] = []; // ascending; never longer than the limit

  return {
    take(count) {
      const t = now();
      takenAt = takenAt.filter((at) => at > t - WINDOW_MS);
      const mustLeave = takenAt.length + count - IMAGE_LIMIT_PER_MINUTE;
      if (mustLeave > 0) {
        const waitMs = takenAt[mustLeave - 1] + WINDOW_MS - t;
        return { ok: false, waitSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
      }
      takenAt.push(...Array<number>(count).fill(t));
      return { ok: true };
    },
  };
}

export const sharedImageLimiter = createImageLimiter();
