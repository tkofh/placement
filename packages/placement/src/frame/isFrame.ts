import type { Frame } from './Frame'

export function isFrame(value: unknown): value is Frame {
  return value instanceof Object && value.toString() === '[object Frame]'
}
