export function isRecordOrArray(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
