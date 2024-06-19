export function roundTo(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
