export function isRecordOrArray(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function hasProperty<K extends string | number | symbol>(
  value: unknown,
  key: K,
): value is Record<K & unknown, unknown> {
  return isRecord(value) && key in value
}
