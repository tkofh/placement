export function parseNumericProp(value: string | number | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    if (value === 0) {
      return undefined
    }

    return value
  }

  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return undefined
  }

  return parsed
}
