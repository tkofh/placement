export function boolProp(value: boolean | undefined | string): boolean {
  return value != null && value !== false && value !== 'false'
}
