const WINDOW_MS = 60 * 60 * 1000;
const MAX_RUNS = 6;
const seen = new Map<string, number[]>();

/** Per-address limit that protects the model budget from one busy visitor. */
export function allow(address: string, now = Date.now()): boolean {
  const recent = (seen.get(address) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_RUNS) {
    seen.set(address, recent);
    return false;
  }
  seen.set(address, [...recent, now]);
  return true;
}
