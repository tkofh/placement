export function spatialOffsets(
  t: number,
  amount: number,
  gap: number,
  items: number,
  space: number,
  spaceOuter: number,
): { start: number; between: number } {
  const distributed = amount * space
  let start = (amount - distributed) * t
  let between = gap

  if (distributed > 0 && items > 1) {
    const spacing = distributed / (items + 1)
    start += spacing * spaceOuter
    between += spacing + (spacing * 2 * (1 - spaceOuter)) / (items - 1)
  }

  return { start, between }
}
