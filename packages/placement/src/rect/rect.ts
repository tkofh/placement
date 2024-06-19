import { allOf, oneOf } from 'valued/combinators'
import { isKeywordValue, keyword } from 'valued/data/keyword'
import { roundTo } from '../utils/math'

const TypeBrand: unique symbol = Symbol('placement/rect')
type TypeBrand = typeof TypeBrand
import { parse } from 'valued'
import { type MapFn, dual, pipe } from '../utils/function'

export interface RectLike {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Rect {
  [TypeBrand]: TypeBrand
  readonly precision: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly area: number
  readonly aspectRatio: number
  readonly pipe: (...fns: ReadonlyArray<MapFn<Rect>>) => Rect
}

const RectProto: Omit<Rect, 'x' | 'y' | 'width' | 'height' | 'precision'> = {
  [TypeBrand]: TypeBrand,
  pipe(...fns: ReadonlyArray<MapFn<Rect>>) {
    return pipe(this as Rect, ...fns)
  },
  get top() {
    return (this as Rect).y
  },
  get bottom() {
    return roundTo(
      (this as Rect).y + (this as Rect).height,
      (this as Rect).precision,
    )
  },
  get left() {
    return (this as Rect).x
  },
  get right() {
    return roundTo(
      (this as Rect).x + (this as Rect).width,
      (this as Rect).precision,
    )
  },
  get area() {
    return roundTo(
      (this as Rect).width * (this as Rect).height,
      (this as Rect).precision,
    )
  },
  get aspectRatio() {
    return roundTo(
      (this as Rect).width / (this as Rect).height,
      (this as Rect).precision,
    )
  },
}

const defaultPrecision = 2

export const rect: {
  (): Rect
  (size: number): Rect
  (width: number, height: number): Rect
  (x: number, y: number, size: number): Rect
  (x: number, y: number, width: number, height: number): Rect
  (x: number, y: number, width: number, height: number, precision: number): Rect
} = (a?: number, b?: number, c?: number, d?: number, p?: number): Rect => {
  const precision = p ?? defaultPrecision
  return Object.assign(Object.create(RectProto), {
    precision,
    x: roundTo(c != null ? (a as number) : 0, precision),
    y: roundTo(c != null ? (b as number) : 0, precision),
    width: roundTo(c != null ? (c as number) : a ?? 0, precision),
    height: roundTo(
      d != null ? (d as number) : c != null ? (c as number) : b ?? 0,
      precision,
    ),
  })
}

export function isRect(value: unknown): value is Rect {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const setX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) =>
  rect(x, self.y, self.width, self.height, self.precision),
)

export const setY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) =>
  rect(self.x, y, self.width, self.height, self.precision),
)

export const setPosition: {
  (self: Rect, position: number): Rect
  (self: Rect, x: number, y: number): Rect
  (position: number): (self: Rect) => Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, x: number, y?: number) =>
    rect(x, y ?? x, self.width, self.height, self.precision),
)

export const setWidth: {
  (self: Rect, width: number): Rect
  (width: number): (self: Rect) => Rect
} = dual(2, (self: Rect, width: number) =>
  rect(self.x, self.y, width, self.height, self.precision),
)

export const setHeight: {
  (self: Rect, height: number): Rect
  (height: number): (self: Rect) => Rect
} = dual(2, (self: Rect, height: number) =>
  rect(self.x, self.y, self.width, height, self.precision),
)

export const setSize: {
  (self: Rect, size: number): Rect
  (self: Rect, width: number, height: number): Rect
  (size: number): (self: Rect) => Rect
  (width: number, height: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, width: number, height?: number) =>
    rect(self.x, self.y, width, height ?? width, self.precision),
)

export const translateX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) =>
  rect(self.x + x, self.y, self.width, self.height, self.precision),
)

export const translateY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) =>
  rect(self.x, self.y + y, self.width, self.height, self.precision),
)

export const translate: {
  (self: Rect, x: number, y: number): Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(3, (self: Rect, x: number, y: number) =>
  rect(self.x + x, self.y + y, self.width, self.height, self.precision),
)

export const scaleX: {
  (self: Rect, scalar: number, origin?: number): Rect
  (scalar: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, scalar: number, origin?: number) => {
    const scaled = self.width * scalar
    const deltaSize = scaled - self.width

    return rect(
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

    return rect(
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

    rect(
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
} = dual(2, (self: Rect, min: number) =>
  rect(Math.max(min, self.x), self.y, self.width, self.height, self.precision),
)

export const maxX: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(2, (self: Rect, max: number) =>
  rect(Math.min(max, self.x), self.y, self.width, self.height, self.precision),
)

export const clampX: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) =>
  rect(
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
} = dual(2, (self: Rect, min: number) =>
  rect(self.x, Math.max(min, self.y), self.width, self.height, self.precision),
)

export const maxY: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(2, (self: Rect, max: number) =>
  rect(self.x, Math.min(max, self.y), self.width, self.height, self.precision),
)

export const clampY: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) =>
  rect(
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
} = dual(2, (self: Rect, min: number) =>
  rect(self.x, self.y, Math.max(min, self.width), self.height, self.precision),
)

export const maxWidth: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(2, (self: Rect, max: number) =>
  rect(self.x, self.y, Math.min(max, self.width), self.height, self.precision),
)

export const clampWidth: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) =>
  rect(
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
} = dual(2, (self: Rect, min: number) =>
  rect(self.x, self.y, self.width, Math.max(min, self.height), self.precision),
)

export const maxHeight: {
  (self: Rect, max: number): Rect
  (max: number): (self: Rect) => Rect
} = dual(2, (self: Rect, max: number) =>
  rect(self.x, self.y, self.width, Math.min(max, self.height), self.precision),
)

export const clampHeight: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
  (min: number): (max: number) => (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) =>
  rect(
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
} = dual(2, (self: Rect, target: Rect) =>
  rect(target.x, self.y, self.width, self.height, self.precision),
)

export const alignRight: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(2, (self: Rect, target: Rect) =>
  rect(
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
} = dual(2, (self: Rect, target: Rect) =>
  rect(self.x, target.y, self.width, self.height, self.precision),
)

export const alignBottom: {
  (self: Rect, target: Rect): Rect
  (target: Rect): (self: Rect) => Rect
} = dual(2, (self: Rect, target: Rect) =>
  rect(
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
} = dual(2, (self: Rect, target: Rect) =>
  rect(
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
} = dual(2, (self: Rect, target: Rect) =>
  rect(
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
} = dual(2, (self: Rect, target: Rect) =>
  rect(
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
  return rect(
    self.x,
    self.y + amount,
    self.width,
    self.height - amount,
    self.precision,
  )
})

export const adjustBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(2, (self: Rect, bottom: number) => {
  const amount = Math.min(self.height, bottom)
  return rect(self.x, self.y, self.width, self.height - amount, self.precision)
})

export const adjustLeft: {
  (self: Rect, left: number): Rect
  (left: number): (self: Rect) => Rect
} = dual(2, (self: Rect, left: number) => {
  const amount = Math.min(self.width, left)
  return rect(
    self.x + amount,
    self.y,
    self.width - amount,
    self.height,
    self.precision,
  )
})

export const adjustRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(2, (self: Rect, right: number) => {
  const amount = Math.min(self.width, right)
  return rect(self.x, self.y, self.width - amount, self.height, self.precision)
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

    return rect(
      self.x + amountLeft,
      self.y,
      self.width - amountLeft - amountRight,
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

    return rect(
      self.x,
      self.y + amountTop,
      self.width,
      self.height - amountTop - amountBottom,
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
  (self: Rect, top: number, right?: number, bottom?: number, left?: number) => {
    const amountTop = Math.min(top, self.height * 0.5)
    const amountRight = Math.min(right ?? top, self.width * 0.5)
    const amountBottom = Math.min(bottom ?? top, self.height * 0.5)
    const amountLeft = Math.min(left ?? right ?? top, self.width * 0.5)

    return rect(
      self.x + amountLeft,
      self.y + amountTop,
      self.width - amountLeft - amountRight,
      self.height - amountTop - amountBottom,
      self.precision,
    )
  },
)
