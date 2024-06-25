import { clamp, normalize } from '../math'

function originToAlignment(origin: number, setting: number): number {
  return normalize(origin, 0, setting)
}

export function offsetFromOrigin(
  subject: number,
  setting: number,
  origin: number,
  clampOrigin = true,
): number {
  const align = originToAlignment(origin, setting)
  return (clampOrigin ? clamp(align, 0, 1) : align) * (subject - setting)
}
