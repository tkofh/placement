import { parse } from 'valued'
import { allOf, oneOf } from 'valued/combinators'
import { isKeywordValue, keyword } from 'valued/data/keyword'
import { Pipeable } from './pipeable'
import { normalizeTRBL, normalizeXYWH } from './utils/arguments'
import { dual } from './utils/function'
import { lerp } from './utils/math'
import { roundTo } from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/rect')
type TypeBrand = typeof TypeBrand

export interface RectLike {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

class Rect extends Pipeable implements RectLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  constructor(
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
    readonly precision: number,
  ) {
    super()
  }

  get top() {
    return this.y
  }

  get bottom() {
    return roundTo(this.y + this.height, this.precision)
  }

  get left() {
    return this.x
  }

  get right() {
    return roundTo(this.x + this.width, this.precision)
  }

  get area() {
    return roundTo(this.width * this.height, this.precision)
  }

  get aspectRatio() {
    return roundTo(this.width / this.height, this.precision)
  }

  get centerX() {
    return roundTo(this.x + this.width / 2, this.precision)
  }

  get centerY() {
    return roundTo(this.y + this.height / 2, this.precision)
  }
}

export type { Rect }

const defaultPrecision = 4

export const rect: {
  (): Rect
  (size: number): Rect
  (width: number, height: number): Rect
  (x: number, y: number, size: number): Rect
  (x: number, y: number, width: number, height: number): Rect
  (x: number, y: number, width: number, height: number, precision: number): Rect
} = (a?: number, b?: number, c?: number, d?: number, p?: number): Rect => {
  return new Rect(...normalizeXYWH(a, b, c, d), p ?? defaultPrecision)
}

export function isRect(value: unknown): value is Rect {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const setX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, x: number) =>
    new Rect(x, self.y, self.width, self.height, self.precision),
)

export const setY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, y: number) =>
    new Rect(self.x, y, self.width, self.height, self.precision),
)

export const setPosition: {
  (self: Rect, position: number): Rect
  (self: Rect, x: number, y: number): Rect
  (position: number): (self: Rect) => Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, x: number, y?: number) =>
    new Rect(x, y ?? x, self.width, self.height, self.precision),
)

export const setWidth: {
  (self: Rect, width: number): Rect
  (width: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, width: number) =>
    new Rect(self.x, self.y, width, self.height, self.precision),
)

export const setHeight: {
  (self: Rect, height: number): Rect
  (height: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, height: number) =>
    new Rect(self.x, self.y, self.width, height, self.precision),
)

export const setSize: {
  (self: Rect, size: number): Rect
  (self: Rect, width: number, height: number): Rect
  (size: number): (self: Rect) => Rect
  (width: number, height: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, width: number, height?: number) =>
    new Rect(self.x, self.y, width, height ?? width, self.precision),
)

export const setPrecision: {
  (self: Rect, precision: number): Rect
  (precision: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, precision: number) =>
    new Rect(self.x, self.y, self.width, self.height, precision),
)

export const translateX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, x: number) =>
    new Rect(self.x + x, self.y, self.width, self.height, self.precision),
)

export const translateY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, y: number) =>
    new Rect(self.x, self.y + y, self.width, self.height, self.precision),
)

export const translate: {
  (self: Rect, x: number, y: number): Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, x: number, y: number) =>
    new Rect(self.x + x, self.y + y, self.width, self.height, self.precision),
)

export const scaleX: {
  (self: Rect, scalar: number, origin?: number): Rect
  (scalar: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, scalar: number, origin?: number) => {
    const scaled = self.width * scalar
    const deltaSize = scaled - self.width

    return new Rect(
      self.x - (origin ?? 0) * deltaSize,
      self.y,
      scaled,
      self.height,
      self.precision,
    )
  },
)

export const scaleY: {
  (self: Rect, scalar: number, origin?: number): Rect
  (scalar: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, scalar: number, origin?: number) => {
    const scaled = self.height * scalar
    const deltaSize = scaled - self.height

    return new Rect(
      self.x,
      self.y - (origin ?? 0) * deltaSize,
      self.width,
      scaled,
      self.precision,
    )
  },
)

export const scale: {
  (self: Rect, scalar: number): Rect
  (self: Rect, scalar: number, origin?: number): Rect
  (scalar: number): (self: Rect) => Rect
  (scalar: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, scalar: number, origin?: number) => {
    const scaledWidth = self.width * scalar
    const scaledHeight = self.height * scalar

    const deltaWidth = scaledWidth - self.width
    const deltaHeight = scaledHeight - self.height

    new Rect(
      self.x - (origin ?? 0) * deltaWidth,
      self.y - (origin ?? 0) * deltaHeight,
      scaledWidth,
      scaledHeight,
      self.precision,
    )
  },
)

export const minX: {
  (self: Rect, min: number): Rect
  (min: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, min: number) =>
    new Rect(
      Math.max(min, self.x),
      self.y,
      self.width,
      self.height,
      self.precision,
    ),
)

export const maxX: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, max: number) =>
    new Rect(
      Math.min(max, self.x),
      self.y,
      self.width,
      self.height,
      self.precision,
    ),
)

export const clampX: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, min: number, max: number) =>
    new Rect(
      Math.min(max, Math.max(min, self.x)),
      self.y,
      self.width,
      self.height,
      self.precision,
    ),
)

export const minY: {
  (self: Rect, min: number): Rect
  (min: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, min: number) =>
    new Rect(
      self.x,
      Math.max(min, self.y),
      self.width,
      self.height,
      self.precision,
    ),
)

export const maxY: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, max: number) =>
    new Rect(
      self.x,
      Math.min(max, self.y),
      self.width,
      self.height,
      self.precision,
    ),
)

export const clampY: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, min: number, max: number) =>
    new Rect(
      self.x,
      Math.min(max, Math.max(min, self.y)),
      self.width,
      self.height,
      self.precision,
    ),
)

export const minWidth: {
  (self: Rect, min: number): Rect
  (min: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, min: number) =>
    new Rect(
      self.x,
      self.y,
      Math.max(min, self.width),
      self.height,
      self.precision,
    ),
)

export const maxWidth: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, max: number) =>
    new Rect(
      self.x,
      self.y,
      Math.min(max, self.width),
      self.height,
      self.precision,
    ),
)

export const clampWidth: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, min: number, max: number) =>
    new Rect(
      self.x,
      self.y,
      Math.min(max, Math.max(min, self.width)),
      self.height,
      self.precision,
    ),
)

export const minHeight: {
  (self: Rect, min: number): Rect
  (min: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, min: number) =>
    new Rect(
      self.x,
      self.y,
      self.width,
      Math.max(min, self.height),
      self.precision,
    ),
)

export const maxHeight: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, max: number) =>
    new Rect(
      self.x,
      self.y,
      self.width,
      Math.min(max, self.height),
      self.precision,
    ),
)

export const clampHeight: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, min: number, max: number) =>
    new Rect(
      self.x,
      self.y,
      self.width,
      Math.min(max, Math.max(min, self.height)),
      self.precision,
    ),
)

export const alignLeft: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(target.x, self.y, self.width, self.height, self.precision),
)

export const alignRight: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      target.right - self.width,
      self.y,
      self.width,
      self.height,
      self.precision,
    ),
)

export const alignTop: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(self.x, target.y, self.width, self.height, self.precision),
)

export const alignBottom: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      self.x,
      target.bottom - self.height,
      self.width,
      self.height,
      self.precision,
    ),
)

export const alignCenterX: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      target.x + (target.width - self.width) / 2,
      self.y,
      self.width,
      self.height,
      self.precision,
    ),
)

export const alignCenterY: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      self.x,
      target.y + (target.height - self.height) / 2,
      self.width,
      self.height,
      self.precision,
    ),
)

export const alignCenter: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      target.x + (target.width - self.width) / 2,
      target.y + (target.width - self.height) / 2,
      self.width,
      self.height,
      self.precision,
    ),
)

const parser = oneOf([
  oneOf([
    keyword('top'),
    keyword('center'),
    keyword('bottom'),
    keyword('right'),
    keyword('left'),
  ]),
  allOf([
    oneOf([keyword('top'), keyword('center'), keyword('bottom')]),
    oneOf([keyword('left'), keyword('center'), keyword('right')]),
  ]),
])

const parseAlign = (value: string) => parse(value, parser)

type AlignY = 'top' | 'center' | 'bottom'
type AlignX = 'left' | 'center' | 'right'
type Align = AlignX | AlignY | `${AlignX} ${AlignY}` | `${AlignY} ${AlignX}`

export const align: {
  (self: Rect, target: Rect, align: Align): Rect
  (target: Rect, align: Align): (self: Rect) => Rect
} = dual(3, (self: Rect, target: Rect, align: Align) => {
  const alignment = parseAlign(align)

  if (!alignment.valid) {
    throw new TypeError('Invalid alignment')
  }

  if (isKeywordValue(alignment.value)) {
    switch (alignment.value.value) {
      case 'top':
        return alignTop(self, target)
      case 'center':
        return alignCenter(self, target)
      case 'bottom':
        return alignBottom(self, target)
      case 'left':
        return alignLeft(self, target)
      case 'right':
        return alignRight(self, target)
    }
  }

  const [y, x] = alignment.value

  return self.pipe(
    {
      top: () => alignTop(target),
      center: () => alignCenterY(target),
      bottom: () => alignBottom(target),
    }[y.value](),
    {
      left: () => alignLeft(target),
      center: () => alignCenterX(target),
      right: () => alignRight(target),
    }[x.value](),
  )
})

export const adjustTop: {
  (self: Rect, top: number): Rect
  (top: number): (self: Rect) => Rect
} = dual(2, (self: Rect, top: number) => {
  const amount = Math.min(self.height, top)
  return new Rect(
    self.x,
    self.y - amount,
    self.width,
    self.height + amount,
    self.precision,
  )
})

export const adjustBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(2, (self: Rect, bottom: number) => {
  const amount = Math.min(self.height, bottom)
  return new Rect(
    self.x,
    self.y,
    self.width,
    self.height - amount,
    self.precision,
  )
})

export const adjustLeft: {
  (self: Rect, left: number): Rect
  (left: number): (self: Rect) => Rect
} = dual(2, (self: Rect, left: number) => {
  const amount = Math.min(self.width, left)
  return new Rect(
    self.x - amount,
    self.y,
    self.width + amount,
    self.height,
    self.precision,
  )
})

export const adjustRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(2, (self: Rect, right: number) => {
  const amount = Math.min(self.width, right)
  return new Rect(
    self.x,
    self.y,
    self.width - amount,
    self.height,
    self.precision,
  )
})

export const adjustX: {
  (self: Rect, amount: number): Rect
  (self: Rect, left: number, right: number): Rect
  (amount: number): (self: Rect) => Rect
  (left: number, right: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, left: number, right?: number) => {
    const amountLeft = Math.min(left, self.width * 0.5)
    const amountRight = Math.min(right ?? left, self.width * 0.5)

    return new Rect(
      self.x - amountLeft,
      self.y,
      self.width + amountLeft + amountRight,
      self.height,
      self.precision,
    )
  },
)

export const adjustY: {
  (self: Rect, amount: number): Rect
  (self: Rect, top: number, bottom: number): Rect
  (amount: number): (self: Rect) => Rect
  (top: number, bottom: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, top: number, bottom?: number) => {
    const amountTop = Math.min(top, self.height * 0.5)
    const amountBottom = Math.min(bottom ?? top, self.height * 0.5)

    return new Rect(
      self.x,
      self.y - amountTop,
      self.width,
      self.height + amountTop + amountBottom,
      self.precision,
    )
  },
)

export const adjust: {
  (self: Rect, amount: number): Rect
  (self: Rect, y: number, x: number): Rect
  (self: Rect, top: number, x: number, bottom: number): Rect
  (self: Rect, top: number, right: number, bottom: number, left: number): Rect
  (amount: number): (self: Rect) => Rect
  (y: number, x: number): (self: Rect) => Rect
  (top: number, x: number, bottom: number): (self: Rect) => Rect
  (
    top: number,
    right: number,
    bottom: number,
    left: number,
  ): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, t: number, r?: number, b?: number, l?: number) => {
    const [top, left, bottom, right] = normalizeTRBL(t, r, b, l)
    const amountTop = Math.max(top, self.height * -0.5)
    const amountRight = Math.max(right, self.width * -0.5)
    const amountBottom = Math.max(bottom, self.height * -0.5)
    const amountLeft = Math.max(left, self.width * -0.5)

    return new Rect(
      self.x - amountLeft,
      self.y - amountTop,
      self.width + amountLeft + amountRight,
      self.height + amountTop + amountBottom,
      self.precision,
    )
  },
)

export const moveTop: {
  (self: Rect, top: number): Rect
  (top: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, top: number) =>
    new Rect(
      self.x,
      Math.min(self.bottom, self.y + top),
      self.width,
      Math.abs(self.bottom - (self.y + top)),
      self.precision,
    ),
)

export const moveBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, bottom: number) =>
    new Rect(
      self.x,
      Math.min(self.y, self.bottom + bottom),
      self.width,
      Math.abs(self.y - (self.bottom + bottom)),
      self.precision,
    ),
)

export const moveLeft: {
  (self: Rect, left: number): Rect
  (left: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, left: number) =>
    new Rect(
      Math.min(self.right, self.x + left),
      self.y,
      Math.abs(self.right - (self.x + left)),
      self.height,
      self.precision,
    ),
)

export const moveRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, right: number) =>
    new Rect(
      Math.min(self.x, self.right + right),
      self.y,
      Math.abs(self.x - (self.right + right)),
      self.height,
      self.precision,
    ),
)

export const move: {
  (self: Rect, top: number, right: number, bottom: number, left: number): Rect
  (
    top: number,
    right: number,
    bottom: number,
    left: number,
  ): (self: Rect) => Rect
} = dual(
  5,
  (self: Rect, top: number, right: number, bottom: number, left: number) =>
    new Rect(
      Math.min(self.right + right, self.x + left),
      Math.min(self.bottom + bottom, self.y + top),
      Math.abs(self.right + right - (self.x + left)),
      Math.abs(self.bottom + bottom - (self.y + top)),
      self.precision,
    ),
)

export const join: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, target: Rect) =>
    new Rect(
      Math.min(self.x, target.x),
      Math.min(self.y, target.y),
      Math.max(self.right, target.right),
      Math.max(self.bottom, target.bottom),
      self.precision,
    ),
)

export const intersect: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(2, (self: Rect, target: Rect) => {
  if (
    self.x < target.right &&
    self.right > target.x &&
    self.y < target.bottom &&
    self.bottom > target.y
  ) {
    const x = Math.max(self.x, target.x)
    const y = Math.max(self.y, target.y)
    return new Rect(
      x,
      y,
      Math.min(self.right, target.right) - x,
      Math.min(self.bottom, target.bottom) - y,
      self.precision,
    )
  }
  return new Rect(
    lerp(0.5, self.centerX, target.centerX),
    lerp(0.5, self.centerY, target.centerY),
    0,
    0,
    self.precision,
  )
})

export const contain: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    const scale = Math.min(
      target.width / self.width,
      target.height / self.height,
    )
    const width = self.width * scale
    const height = self.height * scale

    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
      self.precision,
    )
  },
)

export const cover: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    const scale = Math.max(
      target.width / self.width,
      target.height / self.height,
    )
    const width = self.width * scale
    const height = self.height * scale
    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
      self.precision,
    )
  },
)

export const crop: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(2, (self: Rect, target: Rect) => {
  const x = Math.max(self.x, target.x)
  const y = Math.max(self.y, target.y)
  return new Rect(
    x,
    y,
    Math.min(self.right, target.right) - x,
    Math.min(self.bottom, target.bottom) - y,
    self.precision,
  )
})

export const fit: {
  (self: Rect, target: Rect, fit: 'contain' | 'cover', origin?: number): Rect
  (self: Rect, target: Rect, fit: 'crop'): Rect
  (
    target: Rect,
    fit: 'contain' | 'cover',
    origin?: number,
  ): (self: Rect) => Rect
  (target: Rect, fit: 'crop'): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (
    self: Rect,
    target: Rect,
    fit: 'contain' | 'cover' | 'crop',
    origin = 0.5,
  ) => {
    if (fit === 'contain') {
      return contain(self, target, origin)
    }

    if (fit === 'cover') {
      return cover(self, target, origin)
    }

    return crop(self, target)
  },
)
