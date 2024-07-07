export function minMax(min: number, max: number) {
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  }
}

export function clamp(value: number, min: number, max: number) {
  const bounds = minMax(min, max)
  return Math.min(Math.max(value, bounds.min), bounds.max)
}

export function lerp(t: number, a: number, b: number) {
  if (a === b) {
    return a
  }

  return (1 - t) * a + t * b
}

export function normalize(value: number, a: number, b: number) {
  if (a === b) {
    return a
  }

  const bounds = minMax(a, b)

  return (value - bounds.min) / (bounds.max - bounds.min)
}

export function remap(
  value: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
) {
  const normalized = normalize(value, x1, x2)
  return lerp(normalized, y1, y2)
}

export function roundTo(value: number, precision: number) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

export function normalizeZero(value: number) {
  return value === 0 ? 0 : value
}
