import { PRECISION } from './constants'
import { Pipeable } from './internal/pipeable'
import type { Rect } from './rect'
import { dual } from './utils/function'
import {
  clamp as clampNumber,
  aspectRatio as getAspectRatio,
  lerp,
  roundTo,
} from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/dimension')
type TypeBrand = typeof TypeBrand

export interface DimensionsLike {
  readonly width: number
  readonly height: number
}

class Dimensions extends Pipeable implements DimensionsLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly width: number
  readonly height: number
  readonly area: number
  readonly aspectRatio: number

  constructor(
    width: number,
    height: number,
    readonly precision: number,
  ) {
    super()

    this.width = roundTo(Math.abs(width), precision)
    this.height = roundTo(Math.abs(height), precision)
    this.area = roundTo(this.width * this.height, precision)
    this.aspectRatio = getAspectRatio(this.width, this.height, precision)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Dimension [${this.width}x${this.height}]`
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      precision: this.precision,
    }
  }
}

export type { Dimensions }

interface DimensionsConstructor {
  (): Dimensions
  (size: number): Dimensions
  (width: number, height: number): Dimensions
  (width: number, height: number, precision: number): Dimensions

  zero: Dimensions
  infinity: Dimensions
}

const dimensions = ((a?: number, b?: number, c?: number): Dimensions => {
  return new Dimensions(a ?? 0, b ?? a ?? 0, c ?? PRECISION)
}) as DimensionsConstructor

dimensions.zero = new Dimensions(0, 0, PRECISION)
dimensions.infinity = new Dimensions(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  PRECISION,
)

export { dimensions }

export function isDimensions(value: unknown): value is Dimensions {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const width: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, width: number) =>
    new Dimensions(width, self.height, self.precision),
)

export const height: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, height: number) =>
    new Dimensions(self.width, height, self.precision),
)

export const precision: {
  (self: Dimensions | Rect, precision: number): Dimensions
  (precision: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, precision: number) =>
    new Dimensions(self.width, self.height, Math.abs(precision)),
)

export const minWidth: {
  (self: Dimensions | Rect, minWidth: number): Dimensions
  (minWidth: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, minWidth: number) =>
    new Dimensions(Math.max(minWidth, self.width), self.height, self.precision),
)

export const maxWidth: {
  (self: Dimensions | Rect, maxWidth: number): Dimensions
  (maxWidth: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, maxWidth: number) =>
    new Dimensions(Math.min(maxWidth, self.width), self.height, self.precision),
)

export const minHeight: {
  (self: Dimensions | Rect, minHeight: number): Dimensions
  (minHeight: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, minHeight: number) =>
    new Dimensions(
      self.width,
      Math.max(minHeight, self.height),
      self.precision,
    ),
)

export const maxHeight: {
  (self: Dimensions | Rect, maxHeight: number): Dimensions
  (maxHeight: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, maxHeight: number) =>
    new Dimensions(
      self.width,
      Math.min(maxHeight, self.height),
      self.precision,
    ),
)

export const minSize: {
  (self: Dimensions | Rect, minSize: Dimensions | Rect | number): Dimensions
  (minSize: Dimensions | Rect | number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, minSize: Dimensions | Rect | number) => {
  const minWidth = typeof minSize === 'number' ? minSize : minSize.width
  const minHeight = typeof minSize === 'number' ? minSize : minSize.height
  return new Dimensions(
    Math.max(minWidth, self.width),
    Math.max(minHeight, self.height),
    self.precision,
  )
})

export const maxSize: {
  (self: Dimensions | Rect, maxSize: Dimensions | Rect | number): Dimensions
  (maxSize: Dimensions | Rect | number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, maxSize: Dimensions | Rect | number) => {
  const maxWidth = typeof maxSize === 'number' ? maxSize : maxSize.width
  const maxHeight = typeof maxSize === 'number' ? maxSize : maxSize.height
  return new Dimensions(
    Math.min(maxWidth, self.width),
    Math.min(maxHeight, self.height),
    self.precision,
  )
})

export const clampWidth: {
  (self: Dimensions | Rect, minWidth: number, maxWidth: number): Dimensions
  (minWidth: number, maxWidth: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, minWidth: number, maxWidth: number) =>
    new Dimensions(
      clampNumber(self.width, minWidth, maxWidth),
      self.height,
      self.precision,
    ),
)

export const clampHeight: {
  (self: Dimensions | Rect, minHeight: number, maxHeight: number): Dimensions
  (
    minHeight: number,
    maxHeight: number,
  ): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, minHeight: number, maxHeight: number) =>
    new Dimensions(
      self.width,
      clampNumber(self.height, minHeight, maxHeight),
      self.precision,
    ),
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
  (
    self: Dimensions | Rect,
    min: Dimensions | Rect | number,
    max: Dimensions | Rect | number,
  ) => {
    const minWidth = typeof min === 'number' ? min : min.width
    const minHeight = typeof min === 'number' ? min : min.height
    const maxWidth = typeof max === 'number' ? max : max.width
    const maxHeight = typeof max === 'number' ? max : max.height
    return new Dimensions(
      clampNumber(self.width, minWidth, Math.max(minWidth, maxWidth)),
      clampNumber(self.height, minHeight, Math.max(minHeight, maxHeight)),
      self.precision,
    )
  },
)

interface AspectRatio {
  (
    self: Dimensions | Rect,
    aspectRatio: number,
    alterWidth?: number,
    alterHeight?: number,
  ): Dimensions
  (
    aspectRatio: number,
    alterWidth?: number,
    alterHeight?: number,
  ): (self: Dimensions | Rect) => Dimensions
  fixWidth: {
    (self: Dimensions | Rect, aspectRatio: number): Dimensions
    (aspectRatio: number): (self: Dimensions | Rect) => Dimensions
  }
  fixHeight: {
    (self: Dimensions | Rect, aspectRatio: number): Dimensions
    (aspectRatio: number): (self: Dimensions | Rect) => Dimensions
  }
}

const aspectRatio = dual(
  (args) => isDimensions(args[0]),
  (
    self: Dimensions | Rect,
    aspectRatio: number,
    alterWidth = 0.5,
    alterHeight = 0.5,
  ) => {
    const alteredWidth = self.height * aspectRatio
    const alteredHeight = self.width / aspectRatio

    let normalizedAlterWidth = alterWidth
    let normalizedAlterHeight = alterHeight

    if (normalizedAlterWidth === 0 && normalizedAlterHeight === 0) {
      normalizedAlterWidth = 0.5
      normalizedAlterHeight = 0.5
    } else {
      normalizedAlterWidth = normalizedAlterWidth / (alterWidth + alterHeight)
      normalizedAlterHeight = normalizedAlterHeight / (alterWidth + alterHeight)
    }

    return new Dimensions(
      lerp(normalizedAlterWidth, self.width, alteredWidth),
      lerp(normalizedAlterHeight, self.height, alteredHeight),
      self.precision,
    )
  },
) as AspectRatio
aspectRatio.fixWidth = dual(
  2,
  (self: Dimensions | Rect, aspectRatio: number) =>
    new Dimensions(self.width, self.width / aspectRatio, self.precision),
)
aspectRatio.fixHeight = dual(
  2,
  (self: Dimensions | Rect, aspectRatio: number) =>
    new Dimensions(self.height * aspectRatio, self.height, self.precision),
)
export { aspectRatio }

export const scale: {
  (self: Dimensions | Rect, scale: number): Dimensions
  (self: Dimensions | Rect, x: number, y: number): Dimensions
  (scale: number): (self: Dimensions | Rect) => Dimensions
  (x: number, y: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensions(args[0]),
  (self: Dimensions | Rect, x: number, y?: number) =>
    new Dimensions(self.width * x, self.height * (y ?? x), self.precision),
)

export const scaleX: {
  (self: Dimensions | Rect, scale: number): Dimensions
  (scale: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, scale: number) =>
    new Dimensions(self.width * scale, self.height, self.precision),
)

export const scaleY: {
  (self: Dimensions | Rect, scale: number): Dimensions
  (scale: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  2,
  (self: Dimensions | Rect, scale: number) =>
    new Dimensions(self.width, self.height * scale, self.precision),
)

export const scaleTo: {
  (self: Dimensions | Rect, area: number): Dimensions
  (area: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, area: number) => {
  if (self.area === 0) {
    const size = Math.sqrt(area)
    return new Dimensions(size, size, self.precision)
  }

  const scale = Math.sqrt(area / self.area)
  return new Dimensions(self.width * scale, self.height * scale, self.precision)
})

export const scaleToWidth: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, width: number) => {
  const scale = width / self.width
  return new Dimensions(width, self.height * scale, self.precision)
})

export const scaleToHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => {
  const scale = height / self.height
  return new Dimensions(self.width * scale, height, self.precision)
})

export const contain: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  if (ratio === 0) {
    return new Dimensions(0, self.height, self.precision)
  }

  if (ratio === self.aspectRatio) {
    return self
  }

  if (ratio > self.aspectRatio) {
    return new Dimensions(self.width, self.width / ratio, self.precision)
  }

  return new Dimensions(self.height * ratio, self.height, self.precision)
})

export const cover: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  if (ratio === 0) {
    return new Dimensions(self.width, 0, self.precision)
  }

  if (ratio === self.aspectRatio) {
    return self
  }

  if (ratio > self.aspectRatio) {
    return new Dimensions(self.width * ratio, self.width, self.precision)
  }

  return new Dimensions(self.height, self.height / ratio, self.precision)
})

export const mix: {
  (
    self: Dimensions | Rect,
    other: Dimensions | Rect,
    amount: number,
  ): Dimensions
  (
    other: Dimensions | Rect,
    amount: number,
  ): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, other: Dimensions | Rect, amount = 0.5) => {
    const width = lerp(amount, self.width, other.width)
    const height = lerp(amount, self.height, other.height)
    return new Dimensions(width, height, self.precision)
  },
)
