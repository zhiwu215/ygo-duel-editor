export const INFINITY_VALUE = 99999999
export function isInfiniteVal(val: number | undefined | null): boolean {
  if (val === undefined || val === null) return false
  return val >= INFINITY_VALUE || val === Infinity
}
