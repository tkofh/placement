import {
  EPSILON,
  RELATIVE_TOLERANCE,
  clamp as clampNumber,
  coincident,
  lerp as lerpNumber,
  minMax,
} from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Dimensions } from './dimensions.ts'
import type { Interval } from './interval.ts'
import type { Offset } from './offset.ts'
import { type Point, type PointLike, isPoint, point } from './point.ts'
import { normalizeTRBL, normalizeXYWH } from './utils/arguments.ts'
import { isRecord } from './utils/object.ts'

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

  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number

  constructor(x: number, y: number, width: number, height: number) {
    super()

    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  get top(): number {
    return this.y
  }

  get bottom(): number {
    return this.y + this.height
  }

  get left(): number {
    return this.x
  }

  get right(): number {
    return this.x + this.width
  }

  get area(): number {
    return this.width * this.height
  }

  get aspectRatio(): number {
    return this.width / this.height
  }

  get centerX(): number {
    return this.x + this.width / 2
  }

  get centerY(): number {
    return this.y + this.height / 2
  }

  get center(): Point {
    return point(this.centerX, this.centerY)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Rect [(${this.x}, ${this.y}) ${this.width}x${this.height}]`
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    }
  }
}

export type { Rect }

interface RectConstructor {
  (): Rect
  (size: number): Rect
  (width: number, height: number): Rect
  (x: number, y: number, size: number): Rect
  (x: number, y: number, width: number, height: number): Rect

  from(rect: RectLike): Rect
  fromDimensions(dimensions: Dimensions, position?: PointLike): Rect
  fromInterval(x: Interval, y?: Interval): Rect
  trbl(top: number, right?: number, bottom?: number, left?: number): Rect

  zero: Rect
}

const rect = ((a?: number, b?: number, c?: number, d?: number): Rect =>
  new Rect(...normalizeXYWH(a, b, c, d))) as RectConstructor

rect.from = (input: RectLike) => new Rect(input.x, input.y, input.width, input.height)

rect.fromDimensions = (dimensions: Dimensions, position?: PointLike) =>
  new Rect(position?.x ?? 0, position?.y ?? 0, dimensions.width, dimensions.height)

rect.fromInterval = (x: Interval, y: Interval = x) => new Rect(x.start, y.start, x.size, y.size)

// The arguments are absolute edge coordinates (CSS shorthand fallbacks
// apply): the result spans left to right and top to bottom, exactly as given.
rect.trbl = (top: number, right?: number, bottom?: number, left?: number) => {
  const [t, r, b, l] = normalizeTRBL(top, right, bottom, left)
  return new Rect(l, t, r - l, b - t)
}

rect.zero = new Rect(0, 0, 0, 0)

export { rect }

export const isRect = (value: unknown): value is Rect => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const isRectLike = (value: unknown): value is RectLike => {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  )
}

// Tolerance for boundary decisions, scaled to the magnitudes that enter the
// question (see PRECISION.md).
const boundsTolerance = (min: number, max: number): number =>
  EPSILON + RELATIVE_TOLERANCE * Math.max(Math.abs(min), Math.abs(max))

// Negative sizes are legal, so bounds questions operate on the normalized
// extents [xMin, xMax, yMin, yMax].
const bounds = (target: RectLike): [number, number, number, number] => {
  const [xMin, xMax] = minMax(target.x, target.x + target.width)
  const [yMin, yMax] = minMax(target.y, target.y + target.height)
  return [xMin, xMax, yMin, yMax]
}

export const setX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) => new Rect(x, self.y, self.width, self.height))

export const setY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) => new Rect(self.x, y, self.width, self.height))

export const setPosition: {
  (self: Rect, x: number, y?: number): Rect
  (x: number, y?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, x: number, y?: number) => new Rect(x, y ?? x, self.width, self.height),
)

export const setWidth: {
  (self: Rect, width: number): Rect
  (width: number): (self: Rect) => Rect
} = dual(2, (self: Rect, width: number) => new Rect(self.x, self.y, width, self.height))

export const setHeight: {
  (self: Rect, height: number): Rect
  (height: number): (self: Rect) => Rect
} = dual(2, (self: Rect, height: number) => new Rect(self.x, self.y, self.width, height))

export const setSize: {
  (self: Rect, width: number, height?: number): Rect
  (width: number, height?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, width: number, height?: number) => new Rect(self.x, self.y, width, height ?? width),
)

export const setRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, right: number) => new Rect(right - self.width, self.y, self.width, self.height),
)

export const setBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, bottom: number) => new Rect(self.x, bottom - self.height, self.width, self.height),
)

export const translateX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) => new Rect(self.x + x, self.y, self.width, self.height))

export const translateY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) => new Rect(self.x, self.y + y, self.width, self.height))

export const translate: {
  (self: Rect, x: number, y: number): Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, x: number, y: number) => new Rect(self.x + x, self.y + y, self.width, self.height),
)

export const scaleX: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x + (self.width - self.width * factor) * origin,
      self.y,
      self.width * factor,
      self.height,
    ),
)

export const scaleY: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x,
      self.y + (self.height - self.height * factor) * origin,
      self.width,
      self.height * factor,
    ),
)

export const scale: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x + (self.width - self.width * factor) * origin,
      self.y + (self.height - self.height * factor) * origin,
      self.width * factor,
      self.height * factor,
    ),
)

export const scaleFrom: {
  (self: Rect, factor: number, position: PointLike): Rect
  (factor: number, position: PointLike): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, factor: number, position: PointLike) =>
    new Rect(
      position.x + (self.x - position.x) * factor,
      position.y + (self.y - position.y) * factor,
      self.width * factor,
      self.height * factor,
    ),
)

export const clampX: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  // The minimum wins when the bounds cross (CSS clamp semantics).
  return new Rect(clampNumber(self.x, min, Math.max(min, max)), self.y, self.width, self.height)
})

export const clampY: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, clampNumber(self.y, min, Math.max(min, max)), self.width, self.height)
})

export const clampWidth: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, self.y, clampNumber(self.width, min, Math.max(min, max)), self.height)
})

export const clampHeight: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, self.y, self.width, clampNumber(self.height, min, Math.max(min, max)))
})

// The align family takes fixed arities: the target is itself a Rect (or a
// Point), so a trailing optional origin would make 2-argument calls
// ambiguous between the data-first and data-last forms.
export const alignX: {
  (self: Rect, target: Rect, origin: number): Rect
  (target: Rect, origin: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: Rect, origin: number) =>
    new Rect(target.x + (target.width - self.width) * origin, self.y, self.width, self.height),
)

export const alignY: {
  (self: Rect, target: Rect, origin: number): Rect
  (target: Rect, origin: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: Rect, origin: number) =>
    new Rect(self.x, target.y + (target.height - self.height) * origin, self.width, self.height),
)

export const align: {
  (self: Rect, target: Rect | Point, origin: number | Point): Rect
  (target: Rect | Point, origin: number | Point): (self: Rect) => Rect
} = dual(3, (self: Rect, target: Rect | Point, origin: number | Point) => {
  const originX = isPoint(origin) ? origin.x : origin
  const originY = isPoint(origin) ? origin.y : origin

  // A point target is a zero-extent rect at that position.
  const targetWidth = isPoint(target) ? 0 : target.width
  const targetHeight = isPoint(target) ? 0 : target.height

  return new Rect(
    target.x + (targetWidth - self.width) * originX,
    target.y + (targetHeight - self.height) * originY,
    self.width,
    self.height,
  )
})

// resizeTop/resizeRight/resizeBottom/resizeLeft move one edge to an absolute
// coordinate with the opposite edge fixed; crossing edges flip (size stays
// non-negative) rather than clamp.
export const resizeTop: {
  (self: Rect, top: number): Rect
  (top: number): (self: Rect) => Rect
} = dual(2, (self: Rect, top: number) => {
  const [min, max] = minMax(top, self.bottom)
  return new Rect(self.x, min, self.width, max - min)
})

export const resizeRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(2, (self: Rect, right: number) => {
  const [min, max] = minMax(self.x, right)
  return new Rect(min, self.y, max - min, self.height)
})

export const resizeBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(2, (self: Rect, bottom: number) => {
  const [min, max] = minMax(self.y, bottom)
  return new Rect(self.x, min, self.width, max - min)
})

export const resizeLeft: {
  (self: Rect, left: number): Rect
  (left: number): (self: Rect) => Rect
} = dual(2, (self: Rect, left: number) => {
  const [min, max] = minMax(left, self.right)
  return new Rect(min, self.y, max - min, self.height)
})

export const resizeX: {
  (self: Rect, delta: number, origin?: number): Rect
  (delta: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number, origin = 0) =>
    new Rect(self.x - delta * origin, self.y, self.width + delta, self.height),
)

export const resizeY: {
  (self: Rect, delta: number, origin?: number): Rect
  (delta: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number, origin = 0) =>
    new Rect(self.x, self.y - delta * origin, self.width, self.height + delta),
)

export const resize: {
  (self: Rect, delta: number | Point, origin?: number | Point): Rect
  (delta: number | Point, origin?: number | Point): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number | Point, origin: number | Point = 0) => {
    const deltaX = isPoint(delta) ? delta.x : delta
    const deltaY = isPoint(delta) ? delta.y : delta
    const originX = isPoint(origin) ? origin.x : origin
    const originY = isPoint(origin) ? origin.y : origin

    return new Rect(
      self.x - deltaX * originX,
      self.y - deltaY * originY,
      self.width + deltaX,
      self.height + deltaY,
    )
  },
)

export const contract: {
  (self: Rect, value: Offset | number): Rect
  (value: Offset | number): (self: Rect) => Rect
} = dual(2, (self: Rect, value: Offset | number) => {
  const top = typeof value === 'number' ? value : value.top
  const right = typeof value === 'number' ? value : value.right
  const bottom = typeof value === 'number' ? value : value.bottom
  const left = typeof value === 'number' ? value : value.left

  // Contraction floors the size at zero; expansion (its inverse) does not.
  return new Rect(
    self.x + left,
    self.y + top,
    Math.max(0, self.width - left - right),
    Math.max(0, self.height - top - bottom),
  )
})

export const expand: {
  (self: Rect, value: Offset | number): Rect
  (value: Offset | number): (self: Rect) => Rect
} = dual(2, (self: Rect, value: Offset | number) => {
  const top = typeof value === 'number' ? value : value.top
  const right = typeof value === 'number' ? value : value.right
  const bottom = typeof value === 'number' ? value : value.bottom
  const left = typeof value === 'number' ? value : value.left

  return new Rect(
    self.x - left,
    self.y - top,
    self.width + left + right,
    self.height + top + bottom,
  )
})

export const join: {
  (self: Rect, other: RectLike): Rect
  (other: RectLike): (self: Rect) => Rect
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const x = Math.min(selfXMin, otherXMin)
  const y = Math.min(selfYMin, otherYMin)

  return new Rect(x, y, Math.max(selfXMax, otherXMax) - x, Math.max(selfYMax, otherYMax) - y)
})

export const intersect: {
  (self: Rect, other: RectLike): Rect
  (other: RectLike): (self: Rect) => Rect
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const xMin = Math.max(selfXMin, otherXMin)
  const xMax = Math.min(selfXMax, otherXMax)
  const yMin = Math.max(selfYMin, otherYMin)
  const yMax = Math.min(selfYMax, otherYMax)

  if (xMin < xMax && yMin < yMax) {
    return new Rect(xMin, yMin, xMax - xMin, yMax - yMin)
  }

  // Disjoint (or merely edge-touching): zero-size rect at the midpoint of
  // the two centers.
  return new Rect(
    (self.centerX + other.x + other.width / 2) / 2,
    (self.centerY + other.y + other.height / 2) / 2,
    0,
    0,
  )
})

// contain/cover/fit dispatch on isRect(args[1]): the data-first form's second
// argument is always the target Rect, while the data-last form's second
// argument is a number, a string, or absent — never ambiguous.
export const contain: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    if (self.area === 0) {
      return target
    }

    const factor = Math.min(target.width / self.width, target.height / self.height)
    const width = self.width * factor
    const height = self.height * factor

    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
    )
  },
)

export const cover: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    if (self.area === 0) {
      return target
    }

    const factor = Math.max(target.width / self.width, target.height / self.height)
    const width = self.width * factor
    const height = self.height * factor

    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
    )
  },
)

export const fit: {
  (self: Rect, target: Rect, mode: 'contain' | 'cover' | 'crop', origin?: number): Rect
  (target: Rect, mode: 'contain' | 'cover' | 'crop', origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, mode: 'contain' | 'cover' | 'crop', origin = 0.5) => {
    if (mode === 'contain') {
      return contain(self, target, origin)
    }

    if (mode === 'cover') {
      return cover(self, target, origin)
    }

    return intersect(self, target)
  },
)

export const lerp: {
  (self: Rect, target: RectLike, amount: number): Rect
  (target: RectLike, amount: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: RectLike, amount: number) =>
    new Rect(
      lerpNumber(amount, self.x, target.x),
      lerpNumber(amount, self.y, target.y),
      lerpNumber(amount, self.width, target.width),
      lerpNumber(amount, self.height, target.height),
    ),
)

export const contains: {
  (self: Rect, target: PointLike | RectLike): boolean
  (target: PointLike | RectLike): (self: Rect) => boolean
} = dual(2, (self: Rect, target: PointLike | RectLike) => {
  const [xMin, xMax, yMin, yMax] = bounds(self)
  const toleranceX = boundsTolerance(xMin, xMax)
  const toleranceY = boundsTolerance(yMin, yMax)

  if (isRectLike(target)) {
    const [targetXMin, targetXMax, targetYMin, targetYMax] = bounds(target)
    return (
      targetXMin >= xMin - toleranceX &&
      targetXMax <= xMax + toleranceX &&
      targetYMin >= yMin - toleranceY &&
      targetYMax <= yMax + toleranceY
    )
  }

  return (
    target.x >= xMin - toleranceX &&
    target.x <= xMax + toleranceX &&
    target.y >= yMin - toleranceY &&
    target.y <= yMax + toleranceY
  )
})

export const intersects: {
  (self: Rect, other: RectLike): boolean
  (other: RectLike): (self: Rect) => boolean
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const toleranceX = boundsTolerance(Math.min(selfXMin, otherXMin), Math.max(selfXMax, otherXMax))
  const toleranceY = boundsTolerance(Math.min(selfYMin, otherYMin), Math.max(selfYMax, otherYMax))

  return (
    selfXMin <= otherXMax + toleranceX &&
    selfXMax >= otherXMin - toleranceX &&
    selfYMin <= otherYMax + toleranceY &&
    selfYMax >= otherYMin - toleranceY
  )
})

export const equals: {
  (self: Rect, other: RectLike): boolean
  (other: RectLike): (self: Rect) => boolean
} = dual(
  2,
  (self: Rect, other: RectLike) =>
    coincident(self.x, other.x) &&
    coincident(self.y, other.y) &&
    coincident(self.width, other.width) &&
    coincident(self.height, other.height),
)
