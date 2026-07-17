import { clamp as clampNumber, coincident, lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Rect } from './rect.ts'
import { isRecord } from './utils/object.ts'

const TypeBrand: unique symbol = Symbol('placement/dimensions')
type TypeBrand = typeof TypeBrand

export interface DimensionsLike {
  readonly width: number
  readonly height: number
}

class Dimensions extends Pipeable implements DimensionsLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    super()

    // Dimensions are magnitudes: abs is a domain rule, not rounding (it is
    // exact — see PRECISION.md).
    this.width = Math.abs(width)
    this.height = Math.abs(height)
  }

  get area(): number {
    return this.width * this.height
  }

  get aspectRatio(): number {
    return this.width / this.height
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Dimensions [${this.width}x${this.height}]`
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
    }
  }
}

export type { Dimensions }

interface DimensionsConstructor {
  (): Dimensions
  (size: number): Dimensions
  (width: number, height: number): Dimensions

  zero: Dimensions
  infinity: Dimensions
}

const dimensions = ((a?: number, b?: number): Dimensions => {
  return new Dimensions(a ?? 0, b ?? a ?? 0)
}) as DimensionsConstructor

dimensions.zero = new Dimensions(0, 0)
dimensions.infinity = new Dimensions(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)

export { dimensions }

export const isDimensions = (value: unknown): value is Dimensions => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const isDimensionsLike = (value: unknown): value is DimensionsLike => {
  return isRecord(value) && typeof value.width === 'number' && typeof value.height === 'number'
}

export const setWidth: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, width: number) => new Dimensions(width, self.height))

export const setHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => new Dimensions(self.width, height))

// Self may be a Rect, so the predicate routes on the Like shape; the
// data-last form's first argument is always a number, never DimensionsLike.
export const setAspectRatio: {
  (self: Dimensions | Rect, ratio: number, bias?: number): Dimensions
  (ratio: number, bias?: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensionsLike(args[0]),
  (self: Dimensions | Rect, ratio: number, bias = 0.5) =>
    // Lerps from keeping the width (bias 0) to keeping the height (bias 1);
    // every blend still has the requested ratio, since height = width / ratio.
    new Dimensions(
      lerpNumber(bias, self.width, self.height * ratio),
      lerpNumber(bias, self.width / ratio, self.height),
    ),
)

export const clampWidth: {
  (self: Dimensions | Rect, minWidth: number, maxWidth: number): Dimensions
  (minWidth: number, maxWidth: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  // The minimum wins when the bounds cross (CSS clamp semantics).
  (self: Dimensions | Rect, minWidth: number, maxWidth: number) =>
    new Dimensions(clampNumber(self.width, minWidth, Math.max(minWidth, maxWidth)), self.height),
)

export const clampHeight: {
  (self: Dimensions | Rect, minHeight: number, maxHeight: number): Dimensions
  (minHeight: number, maxHeight: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, minHeight: number, maxHeight: number) =>
    new Dimensions(self.width, clampNumber(self.height, minHeight, Math.max(minHeight, maxHeight))),
)

export const clamp: {
  (
    self: Dimensions | Rect,
    min: Dimensions | Rect | number,
    max: Dimensions | Rect | number,
  ): Dimensions
  (
    min: Dimensions | Rect | number,
    max: Dimensions | Rect | number,
  ): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, min: Dimensions | Rect | number, max: Dimensions | Rect | number) => {
    const minWidth = typeof min === 'number' ? min : min.width
    const minHeight = typeof min === 'number' ? min : min.height
    const maxWidth = typeof max === 'number' ? max : max.width
    const maxHeight = typeof max === 'number' ? max : max.height
    // The minimum wins when the bounds cross (CSS clamp semantics).
    return new Dimensions(
      clampNumber(self.width, minWidth, Math.max(minWidth, maxWidth)),
      clampNumber(self.height, minHeight, Math.max(minHeight, maxHeight)),
    )
  },
)

export const scale: {
  (self: Dimensions | Rect, scale: number): Dimensions
  (self: Dimensions | Rect, x: number, y: number): Dimensions
  (scale: number): (self: Dimensions | Rect) => Dimensions
  (x: number, y: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensionsLike(args[0]),
  (self: Dimensions | Rect, x: number, y?: number) =>
    new Dimensions(self.width * x, self.height * (y ?? x)),
)

export const scaleTo: {
  (self: Dimensions | Rect, area: number): Dimensions
  (area: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, area: number) => {
  const factor = Math.sqrt(area / (self.width * self.height))
  return new Dimensions(self.width * factor, self.height * factor)
})

export const scaleToWidth: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, width: number) => {
  return new Dimensions(width, self.height * (width / self.width))
})

export const scaleToHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => {
  return new Dimensions(self.width * (height / self.height), height)
})

export const contain: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  const aspectRatio = self.width / self.height

  // A coincident ratio keeps the exact input extents (rewrapped: self may
  // be a Rect) rather than round-tripping them through a division.
  if (coincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(self.width, self.width / ratio)
  }

  return new Dimensions(self.height * ratio, self.height)
})

export const cover: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  const aspectRatio = self.width / self.height

  if (coincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(self.height * ratio, self.height)
  }

  return new Dimensions(self.width, self.width / ratio)
})

export const lerp: {
  (self: Dimensions | Rect, target: DimensionsLike, amount: number): Dimensions
  (target: DimensionsLike, amount: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, target: DimensionsLike, amount: number) =>
    new Dimensions(
      lerpNumber(amount, self.width, target.width),
      lerpNumber(amount, self.height, target.height),
    ),
)

export const equals: {
  (self: Dimensions | Rect, other: DimensionsLike): boolean
  (other: DimensionsLike): (self: Dimensions | Rect) => boolean
} = dual(
  2,
  (self: Dimensions | Rect, other: DimensionsLike) =>
    coincident(self.width, other.width) && coincident(self.height, other.height),
)
