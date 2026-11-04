export const failure = (error: string, status: number) => Response.json({ error }, { status });

// the thrown error is never echoed: its message can hold a file path (NFR-SEC-020)
export function storageFailure(error: unknown, fallbackMessage: string) {
  return (error as NodeJS.ErrnoException).code === "ENOENT" ? failure("ไม่พบแชตนี้", 404) : failure(fallbackMessage, 500);
}
