export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Checks for a plain object: one whose prototype is `Object.prototype` or
 * `null`, as an object literal, `Object.create(null)`, or a `Proxy` of
 * either gives. Class instances, arrays, and functions fail.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a plain object, `false` otherwise.
 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function hasProperty<K extends string | number | symbol>(
  value: unknown,
  key: K,
): value is Record<K & unknown, unknown> {
  return isRecord(value) && key in value
}
