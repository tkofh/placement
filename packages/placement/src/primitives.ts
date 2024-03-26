export interface Dimensions {
  width: number
  height: number
}

export interface FlexibleDimensions {
  width: number | 'auto'
  height: number | 'auto'
}

export function area(dimensions: Dimensions) {
  return dimensions.width * dimensions.height
}

export function aspectRatio(dimensions: Dimensions) {
  return dimensions.width / dimensions.height
}

export interface NormalizedFrame {
  top: number
  right: number
  bottom: number
  left: number
}

export type Frame = number | { x: number; y: number } | NormalizedFrame

export function normalizeFrame(frame: Frame): NormalizedFrame {
  return {
    top: typeof frame === 'number' ? frame : 'y' in frame ? frame.y : frame.top,
    right:
      typeof frame === 'number' ? frame : 'x' in frame ? frame.x : frame.right,
    bottom:
      typeof frame === 'number' ? frame : 'y' in frame ? frame.y : frame.bottom,
    left:
      typeof frame === 'number' ? frame : 'x' in frame ? frame.x : frame.left,
  }
}

export interface Rect extends Dimensions {
  x: number
  y: number
}

export function addFrame(rect: Rect, frame: Frame) {
  const { top, right, bottom, left } = normalizeFrame(frame)

  return {
    x: rect.x + left,
    y: rect.y + top,
    width: Math.max(0, rect.width - (left + right)),
    height: Math.max(0, rect.height - (top + bottom)),
  }
}
