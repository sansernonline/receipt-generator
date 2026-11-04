// Money is computed in whole satang (integers) so there is no float drift.
export const toSatang = (baht: number) => Math.round(baht * 100);
export const toBaht = (satang: number) => satang / 100;

/** numerator / denominator rounded half up (RULE-CALC-050); denominator > 0. */
export function divRoundHalfUp(numerator: number, denominator: number) {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}
