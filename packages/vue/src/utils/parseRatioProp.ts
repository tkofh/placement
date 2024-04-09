export function parseRatioProp(value: string | number | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    if (value === 0) {
      return undefined
    }

    return value
  }

  const [numerator, denominator] = value.split('/')

  const parsedNumerator = Number(numerator)

  if (Number.isNaN(parsedNumerator)) {
    return undefined
  }

  if (denominator === undefined) {
    return parsedNumerator
  }

  const parsedDenominator = Number(denominator)

  if (Number.isNaN(parsedDenominator) || parsedDenominator === 0) {
    return undefined
  }

  return parsedNumerator / parsedDenominator
}
