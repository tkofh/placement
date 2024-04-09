import { roundTo } from './utils'

export interface ReadonlyRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface MutableRect {
  x: number
  y: number
  width: number
  height: number
}

export interface RectPair {
  readonly readonly: ReadonlyRect
  readonly mutable: MutableRect
}

export function createRect(
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  precision = 4,
): RectPair {
  const state: MutableRect = {
    x: roundTo(x, precision),
    y: roundTo(y, precision),
    width: Math.max(roundTo(width, precision), 0),
    height: Math.max(roundTo(height, precision), 0),
  }

  const readonly = Object.defineProperties(
    {},
    {
      x: { enumerable: true, get: () => state.x },
      y: { enumerable: true, get: () => state.y },
      width: { enumerable: true, get: () => state.width },
      height: { enumerable: true, get: () => state.height },
    },
  ) as ReadonlyRect

  const mutable = Object.defineProperties(
    {},
    {
      x: {
        enumerable: true,
        get: () => state.x,
        set: (value: number) => {
          state.x = roundTo(value, precision)
        },
      },
      y: {
        enumerable: true,
        get: () => state.y,
        set: (value: number) => {
          state.y = roundTo(value, precision)
        },
      },
      width: {
        enumerable: true,
        get: () => state.width,
        set: (value: number) => {
          state.width = Math.max(roundTo(value, precision), 0)
        },
      },
      height: {
        enumerable: true,
        get: () => state.height,
        set: (value: number) => {
          state.height = Math.max(roundTo(value, precision), 0)
        },
      },
    },
  ) as MutableRect

  return { readonly, mutable }
}
