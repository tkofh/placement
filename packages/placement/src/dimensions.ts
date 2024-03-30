import { INVALID, parseLength, parseRatio } from './parse'
import { cleanupInput } from './utils'

export type DimensionsWidthInput = 'auto' | (string & {}) | number
export type DimensionsHeightInput = 'auto' | (string & {}) | number
export type DimensionsAspectRatioInput =
  | 'none'
  | 'inherit'
  | (string & {})
  | number

export interface DimensionsInput {
  width: DimensionsWidthInput
  height: DimensionsHeightInput
  aspectRatio: DimensionsAspectRatioInput
}

export interface Dimensions {
  width: number
  height: number
}

export const ZERO: Dimensions = { width: 0, height: 0 }

export function parseDimensions(
  input: DimensionsInput,
  parent: Dimensions,
): Dimensions {
  if (input.width === 'auto' && input.height === 'auto') {
    return ZERO
  }

  const aspectRatio =
    input.aspectRatio === 'inherit'
      ? parent.width / parent.height
      : parseRatio(cleanupInput(input.aspectRatio))

  let width = parseLength(cleanupInput(input.width), parent.width)
  let height = parseLength(cleanupInput(input.height), parent.height)

  if (width === INVALID && height === INVALID) {
    return ZERO
  }

  if (width === INVALID && height !== INVALID && aspectRatio !== INVALID) {
    width = height * aspectRatio
  } else if (
    width !== INVALID &&
    height === INVALID &&
    aspectRatio !== INVALID
  ) {
    height = width / aspectRatio
  }

  if (width === INVALID) {
    width = 0
  }

  if (height === INVALID) {
    height = 0
  }

  return { width, height }
}
