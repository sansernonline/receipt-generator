const KEY = "billgen:ai-notice-acknowledged";

// Only remembers that THIS browser has seen the notice; the record of when lives on the server (NFR-PDPA-040).
// Blocked storage reads as "not seen", so the notice shows again rather than data going out unannounced.
export function hasAcknowledgedAiNotice(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function acknowledgeAiNotice(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // simple: nothing to do; the next send shows the notice again
  }
}
