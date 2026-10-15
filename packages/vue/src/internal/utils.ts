export function boolProp(value: boolean | undefined | string): boolean {
  return value != null && value !== false && value !== 'false'
}

/** Returns the first finite candidate, or the last one when none is finite. */
export function auto(...candidates: [number, ...Array<number>]): number {
  for (const value of candidates) {
    if (Number.isFinite(value)) {
      return value
    }
  }
  return candidates[candidates.length - 1] as number
}
