import { describe, expect, test } from 'vitest'
import { dimensions } from '../src/dimensions.ts'
import { interval } from '../src/interval.ts'
import { offset } from '../src/offset.ts'
import { isPoint, point } from '../src/point.ts'
import {
  type Rect,
  align,
  alignX,
  alignY,
  clampHeight,
  clampWidth,
  clampX,
  clampY,
  contain,
  contains,
  contract,
  cover,
  equals,
  expand,
  fit,
  intersect,
  intersects,
  isRect,
  isRectLike,
  join,
  lerp,
  rect,
  resize,
  resizeBottom,
  resizeLeft,
  resizeRight,
  resizeTop,
  resizeX,
  resizeY,
  scale,
  scaleFrom,
  scaleX,
  scaleY,
  setBottom,
  setHeight,
  setPosition,
  setRight,
  setSize,
  setWidth,
  setX,
  setY,
  translate,
  translateX,
  translateY,
} from '../src/rect.ts'

interface RectCase {
  input: Rect
  operation: (rect: Rect) => Rect
  output: Rect
}

function describeRectOperation(
  name: string,
  cases: ReadonlyArray<RectCase>,
  dataFirst: () => void,
) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })

    test('data-first form', dataFirst)
  })
}

const zero = rect()
const ten = rect(10)
const thirty = rect(30)
const rect1234 = rect(10, 20, 30, 40)

describe('rect', () => {
  test.each([
    { input: rect(), output: rect(0, 0, 0, 0) },
    { input: rect(10), output: rect(0, 0, 10, 10) },
    { input: rect(10, 20), output: rect(0, 0, 10, 20) },
    { input: rect(10, 20, 30), output: rect(10, 20, 30, 30) },
    { input: rect(10, 20, 30, 40), output: rect(10, 20, 30, 40) },
  ])('rect($input): $output', ({ input, output }) => {
    expect(input).toEqual(output)
  })

  test('four arguments are x, y, width, and height', () => {
    const result = rect(10, 20, 30, 40)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.width).toBe(30)
    expect(result.height).toBe(40)
  })

  test('constructions are exact', () => {
    expect(rect(0.1, 0.2, 0.3, 0.4).width).toBe(0.3)
    expect(rect(1e9 + 0.25, 0, 0.5, 0.5).right).toBe(1e9 + 0.75)
  })
})

describe('statics', () => {
  test('zero', () => {
    expect(rect.zero).toEqual(rect(0, 0, 0, 0))
  })

  test('from copies a rect-like', () => {
    expect(rect.from({ x: 10, y: 20, width: 30, height: 40 })).toEqual(rect(10, 20, 30, 40))
    expect(rect.from(rect1234)).toEqual(rect1234)
  })

  test('fromDimensions positions at the origin by default', () => {
    expect(rect.fromDimensions(dimensions(30, 40))).toEqual(rect(0, 0, 30, 40))
  })

  test('fromDimensions takes an optional position, not a precision (regression)', () => {
    expect(rect.fromDimensions(dimensions(30, 40), point(10, 20))).toEqual(rect(10, 20, 30, 40))
    // The old signature read a trailing number as a precision; the second
    // argument is point-like only now, and inputs are stored exactly.
    expect(rect.fromDimensions(dimensions(30, 40), { x: 0.1, y: 1e9 + 0.25 }).y).toBe(1e9 + 0.25)
  })

  test('fromInterval mirrors a single interval onto both axes', () => {
    expect(rect.fromInterval(interval(10, 30))).toEqual(rect(10, 10, 30, 30))
  })

  test('fromInterval takes x and y intervals', () => {
    expect(rect.fromInterval(interval(10, 30), interval(20, 40))).toEqual(rect(10, 20, 30, 40))
  })

  test('trbl spans the given edge coordinates', () => {
    expect(rect.trbl(20, 40, 60, 10)).toEqual(rect(10, 20, 30, 40))
    expect(rect.trbl(10)).toEqual(rect(10, 10, 0, 0))
    expect(rect.trbl(10, 20)).toEqual(rect(20, 10, 0, 0))
  })
})

describe('guards', () => {
  test('isRect', () => {
    expect(isRect(rect())).toBe(true)
    expect(isRect({ x: 0, y: 0, width: 1, height: 1 })).toBe(false)
    expect(isRect(null)).toBe(false)
  })

  test('isRectLike', () => {
    expect(isRectLike(rect())).toBe(true)
    expect(isRectLike({ x: 0, y: 0, width: 1, height: 1 })).toBe(true)
    expect(isRectLike({ x: 0, y: 0 })).toBe(false)
    expect(isRectLike(null)).toBe(false)
  })
})

describe('getters', () => {
  test('edges, area, and centers', () => {
    expect(rect1234.left).toBe(10)
    expect(rect1234.top).toBe(20)
    expect(rect1234.right).toBe(40)
    expect(rect1234.bottom).toBe(60)
    expect(rect1234.area).toBe(1200)
    expect(rect1234.aspectRatio).toBe(0.75)
    expect(rect1234.centerX).toBe(25)
    expect(rect1234.centerY).toBe(40)
  })

  test('center is a point', () => {
    expect(isPoint(rect1234.center)).toBe(true)
    expect(rect1234.center).toEqual(point(25, 40))
  })

  test('aspectRatio is exact IEEE division', () => {
    expect(rect(0, 0, 100, 0).aspectRatio).toBe(Number.POSITIVE_INFINITY)
    expect(rect().aspectRatio).toBeNaN()
  })
})

describeRectOperation(
  'setX',
  [
    { input: zero, operation: setX(50), output: rect(50, 0, 0) },
    { input: zero, operation: setX(-50), output: rect(-50, 0, 0) },
  ],
  () => expect(setX(zero, 50)).toEqual(rect(50, 0, 0)),
)

describeRectOperation(
  'setY',
  [
    { input: zero, operation: setY(50), output: rect(0, 50, 0) },
    { input: zero, operation: setY(-50), output: rect(0, -50, 0) },
  ],
  () => expect(setY(zero, 50)).toEqual(rect(0, 50, 0)),
)

describeRectOperation(
  'setPosition',
  [
    { input: zero, operation: setPosition(50), output: rect(50, 50, 0) },
    { input: zero, operation: setPosition(-50), output: rect(-50, -50, 0) },
    { input: zero, operation: setPosition(50, 100), output: rect(50, 100, 0) },
    { input: zero, operation: setPosition(-50, 100), output: rect(-50, 100, 0) },
  ],
  () => expect(setPosition(zero, 50, 100)).toEqual(rect(50, 100, 0)),
)

describeRectOperation(
  'setWidth',
  [
    { input: zero, operation: setWidth(50), output: rect(0, 0, 50, 0) },
    { input: zero, operation: setWidth(100), output: rect(0, 0, 100, 0) },
  ],
  () => expect(setWidth(zero, 50)).toEqual(rect(0, 0, 50, 0)),
)

describeRectOperation(
  'setHeight',
  [
    { input: zero, operation: setHeight(50), output: rect(0, 0, 0, 50) },
    { input: zero, operation: setHeight(100), output: rect(0, 0, 0, 100) },
  ],
  () => expect(setHeight(zero, 50)).toEqual(rect(0, 0, 0, 50)),
)

describeRectOperation(
  'setSize',
  [
    { input: zero, operation: setSize(50), output: rect(0, 0, 50) },
    { input: zero, operation: setSize(50, 100), output: rect(0, 0, 50, 100) },
  ],
  () => expect(setSize(zero, 50, 100)).toEqual(rect(0, 0, 50, 100)),
)

describeRectOperation(
  'setRight',
  [
    { input: zero, operation: setRight(10), output: rect(10, 0, 0) },
    { input: zero, operation: setRight(-10), output: rect(-10, 0, 0) },
    { input: ten, operation: setRight(20), output: rect(10, 0, 10) },
    { input: ten, operation: setRight(-20), output: rect(-30, 0, 10) },
  ],
  () => expect(setRight(ten, 20)).toEqual(rect(10, 0, 10)),
)

describeRectOperation(
  'setBottom',
  [
    { input: zero, operation: setBottom(10), output: rect(0, 10, 0) },
    { input: zero, operation: setBottom(-10), output: rect(0, -10, 0) },
    { input: ten, operation: setBottom(20), output: rect(0, 10, 10) },
    { input: ten, operation: setBottom(-20), output: rect(0, -30, 10) },
  ],
  () => expect(setBottom(ten, 20)).toEqual(rect(0, 10, 10)),
)

describeRectOperation(
  'translateX',
  [
    { input: zero, operation: translateX(10), output: rect(10, 0, 0) },
    { input: zero, operation: translateX(-10), output: rect(-10, 0, 0) },
  ],
  () => expect(translateX(zero, 10)).toEqual(rect(10, 0, 0)),
)

describeRectOperation(
  'translateY',
  [
    { input: zero, operation: translateY(10), output: rect(0, 10, 0) },
    { input: zero, operation: translateY(-10), output: rect(0, -10, 0) },
  ],
  () => expect(translateY(zero, 10)).toEqual(rect(0, 10, 0)),
)

describeRectOperation(
  'translate',
  [
    { input: zero, operation: translate(10, 20), output: rect(10, 20, 0) },
    { input: zero, operation: translate(-10, -20), output: rect(-10, -20, 0) },
  ],
  () => expect(translate(zero, 10, 20)).toEqual(rect(10, 20, 0)),
)

describeRectOperation(
  'scaleX',
  [
    { input: ten, operation: scaleX(2), output: rect(20, 10) },
    { input: ten, operation: scaleX(2, 0), output: rect(20, 10) },
    { input: ten, operation: scaleX(2, 0.5), output: rect(-5, 0, 20, 10) },
    { input: ten, operation: scaleX(2, 1), output: rect(-10, 0, 20, 10) },
  ],
  () => expect(scaleX(ten, 2, 0.5)).toEqual(rect(-5, 0, 20, 10)),
)

describeRectOperation(
  'scaleY',
  [
    { input: ten, operation: scaleY(2), output: rect(10, 20) },
    { input: ten, operation: scaleY(2, 0), output: rect(10, 20) },
    { input: ten, operation: scaleY(2, 0.5), output: rect(0, -5, 10, 20) },
    { input: ten, operation: scaleY(2, 1), output: rect(0, -10, 10, 20) },
  ],
  () => expect(scaleY(ten, 2, 0.5)).toEqual(rect(0, -5, 10, 20)),
)

describeRectOperation(
  'scale',
  [
    { input: ten, operation: scale(2), output: rect(20) },
    { input: ten, operation: scale(2, 0), output: rect(20) },
    { input: ten, operation: scale(2, 0.5), output: rect(-5, -5, 20) },
    { input: ten, operation: scale(2, 1), output: rect(-10, -10, 20) },
  ],
  () => expect(scale(ten, 2, 1)).toEqual(rect(-10, -10, 20)),
)

describeRectOperation(
  'scaleFrom',
  [
    {
      input: rect(100, 100, 100),
      operation: scaleFrom(2, point(100, 100)),
      output: rect(100, 100, 200),
    },
    {
      input: rect(100, 100, 100),
      operation: scaleFrom(2, point.zero),
      output: rect(200, 200, 200),
    },
    {
      input: rect(100, 100, 100),
      operation: scaleFrom(2, point(200, 200)),
      output: rect(0, 0, 200),
    },
  ],
  () => expect(scaleFrom(rect(100, 100, 100), 2, point(100, 100))).toEqual(rect(100, 100, 200)),
)

describe('clampX', () => {
  test.each([
    { input: zero, operation: clampX(10, 30), output: rect(10, 0, 0) },
    // Crossed bounds: the minimum wins (CSS clamp semantics).
    { input: zero, operation: clampX(30, 10), output: rect(30, 0, 0) },
    { input: zero, operation: clampX(0, 20), output: zero },
    { input: zero, operation: clampX(20, 0), output: rect(20, 0, 0) },
    { input: zero, operation: clampX(-10, 10), output: zero },
    { input: zero, operation: clampX(10, -10), output: rect(10, 0, 0) },
    { input: zero, operation: clampX(-20, 0), output: zero },
    { input: zero, operation: clampX(0, -20), output: zero },
    { input: zero, operation: clampX(-30, -10), output: rect(-10, 0, 0) },
    { input: zero, operation: clampX(-10, -30), output: rect(-10, 0, 0) },
  ])('clampX($input): $output', ({ input, operation, output }) => {
    expect(operation(input)).toEqual(output)
  })

  test('data-first form', () => {
    expect(clampX(zero, 10, 30)).toEqual(rect(10, 0, 0))
  })

  test('data-last form is a single (self) => Rect closure (regression: the curried (min)(max) overload is gone)', () => {
    const operation = clampX(10, 30)
    expect(typeof operation).toBe('function')
    expect(operation(zero)).toEqual(rect(10, 0, 0))
    expect(zero.pipe(operation)).toEqual(rect(10, 0, 0))
  })
})

describeRectOperation(
  'clampY',
  [
    { input: zero, operation: clampY(10, 30), output: rect(0, 10, 0) },
    { input: zero, operation: clampY(30, 10), output: rect(0, 30, 0) },
    { input: zero, operation: clampY(0, 20), output: zero },
    { input: zero, operation: clampY(20, 0), output: rect(0, 20, 0) },
    { input: zero, operation: clampY(-10, 10), output: zero },
    { input: zero, operation: clampY(10, -10), output: rect(0, 10, 0) },
    { input: zero, operation: clampY(-20, 0), output: zero },
    { input: zero, operation: clampY(0, -20), output: zero },
    { input: zero, operation: clampY(-30, -10), output: rect(0, -10, 0) },
    { input: zero, operation: clampY(-10, -30), output: rect(0, -10, 0) },
  ],
  () => expect(clampY(zero, 10, 30)).toEqual(rect(0, 10, 0)),
)

describeRectOperation(
  'clampWidth',
  [
    { input: thirty, operation: clampWidth(40, 60), output: rect(40, 30) },
    { input: thirty, operation: clampWidth(60, 40), output: rect(60, 30) },
    { input: thirty, operation: clampWidth(30, 50), output: rect(30, 30) },
    { input: thirty, operation: clampWidth(50, 30), output: rect(50, 30) },
    { input: thirty, operation: clampWidth(20, 40), output: rect(30, 30) },
    { input: thirty, operation: clampWidth(40, 20), output: rect(40, 30) },
    { input: thirty, operation: clampWidth(10, 30), output: rect(30, 30) },
    { input: thirty, operation: clampWidth(30, 10), output: rect(30, 30) },
    { input: thirty, operation: clampWidth(0, 20), output: rect(20, 30) },
    { input: thirty, operation: clampWidth(20, 0), output: rect(20, 30) },
  ],
  () => expect(clampWidth(thirty, 40, 60)).toEqual(rect(40, 30)),
)

describeRectOperation(
  'clampHeight',
  [
    { input: thirty, operation: clampHeight(40, 60), output: rect(30, 40) },
    { input: thirty, operation: clampHeight(60, 40), output: rect(30, 60) },
    { input: thirty, operation: clampHeight(30, 50), output: thirty },
    { input: thirty, operation: clampHeight(50, 30), output: rect(30, 50) },
    { input: thirty, operation: clampHeight(20, 40), output: thirty },
    { input: thirty, operation: clampHeight(40, 20), output: rect(30, 40) },
    { input: thirty, operation: clampHeight(10, 30), output: thirty },
    { input: thirty, operation: clampHeight(30, 10), output: thirty },
    { input: thirty, operation: clampHeight(0, 20), output: rect(30, 20) },
    { input: thirty, operation: clampHeight(20, 0), output: rect(30, 20) },
  ],
  () => expect(clampHeight(thirty, 40, 60)).toEqual(rect(30, 40)),
)

describeRectOperation(
  'alignX',
  [
    { input: rect(100), operation: alignX(rect(200), 0), output: rect(0, 0, 100) },
    { input: rect(100), operation: alignX(rect(200), 0.5), output: rect(50, 0, 100) },
    { input: rect(100), operation: alignX(rect(200), 1), output: rect(100, 0, 100) },
    { input: rect(100), operation: alignX(rect(200), 1.5), output: rect(150, 0, 100) },
    { input: rect(100), operation: alignX(rect(50, 60, 70, 80), 0), output: rect(50, 0, 100) },
  ],
  () => expect(alignX(rect(100), rect(200), 0.5)).toEqual(rect(50, 0, 100)),
)

describeRectOperation(
  'alignY',
  [
    { input: rect(100), operation: alignY(rect(200), 0), output: rect(0, 0, 100) },
    { input: rect(100), operation: alignY(rect(200), 0.5), output: rect(0, 50, 100) },
    { input: rect(100), operation: alignY(rect(200), 1), output: rect(0, 100, 100) },
    { input: rect(100), operation: alignY(rect(200), 1.5), output: rect(0, 150, 100) },
    { input: rect(100), operation: alignY(rect(50, 60, 70, 80), 1), output: rect(0, 40, 100) },
  ],
  () => expect(alignY(rect(100), rect(200), 0.5)).toEqual(rect(0, 50, 100)),
)

describe('align', () => {
  test('aligns both axes by a numeric origin', () => {
    expect(align(rect(100), rect(200), 0)).toEqual(rect(0, 0, 100))
    expect(align(rect(100), rect(200), 0.5)).toEqual(rect(50, 50, 100))
    expect(align(rect(100), rect(200), 1)).toEqual(rect(100, 100, 100))
  })

  test('point origins align each axis independently', () => {
    expect(align(rect(100), rect(200), point(0.5, 0))).toEqual(rect(50, 0, 100))
    expect(align(rect(100), rect(200), point(1, 0.5))).toEqual(rect(100, 50, 100))
    expect(align(rect(100), rect(200), point(0, 1))).toEqual(rect(0, 100, 100))
    expect(align(rect(100), rect(200), point(0.5, 0.5))).toEqual(rect(50, 50, 100))
  })

  test('point targets have zero extent', () => {
    expect(align(rect(100), point(50, 60), 0)).toEqual(rect(50, 60, 100))
    expect(align(rect(100), point(50, 60), 1)).toEqual(rect(-50, -40, 100))
  })

  test('data-last form, with rect and point targets', () => {
    expect(rect(100).pipe(align(rect(200), 0.5))).toEqual(rect(50, 50, 100))
    expect(rect(100).pipe(align(point(50, 60), 0.5))).toEqual(rect(0, 10, 100))
  })
})

// The resize* edge cases below are the old adjust* suite translated to
// absolute edge coordinates (rect1234's edges: left 10, top 20, right 40,
// bottom 60).
describeRectOperation(
  'resizeTop',
  [
    { input: rect1234, operation: resizeTop(20), output: rect1234 },
    { input: rect1234, operation: resizeTop(30), output: rect(10, 30, 30, 30) },
    { input: rect1234, operation: resizeTop(10), output: rect(10, 10, 30, 50) },
    // Crossing the fixed bottom edge flips instead of clamping.
    { input: rect1234, operation: resizeTop(70), output: rect(10, 60, 30, 10) },
  ],
  () => expect(resizeTop(rect1234, 30)).toEqual(rect(10, 30, 30, 30)),
)

describeRectOperation(
  'resizeRight',
  [
    { input: rect1234, operation: resizeRight(40), output: rect1234 },
    { input: rect1234, operation: resizeRight(50), output: rect(10, 20, 40, 40) },
    { input: rect1234, operation: resizeRight(30), output: rect(10, 20, 20, 40) },
    { input: rect1234, operation: resizeRight(0), output: rect(0, 20, 10, 40) },
  ],
  () => expect(resizeRight(rect1234, 50)).toEqual(rect(10, 20, 40, 40)),
)

describeRectOperation(
  'resizeBottom',
  [
    { input: rect1234, operation: resizeBottom(60), output: rect1234 },
    { input: rect1234, operation: resizeBottom(70), output: rect(10, 20, 30, 50) },
    { input: rect1234, operation: resizeBottom(50), output: rect(10, 20, 30, 30) },
    { input: rect1234, operation: resizeBottom(0), output: rect(10, 0, 30, 20) },
  ],
  () => expect(resizeBottom(rect1234, 70)).toEqual(rect(10, 20, 30, 50)),
)

describeRectOperation(
  'resizeLeft',
  [
    { input: rect1234, operation: resizeLeft(10), output: rect1234 },
    { input: rect1234, operation: resizeLeft(20), output: rect(20, 20, 20, 40) },
    { input: rect1234, operation: resizeLeft(0), output: rect(0, 20, 40, 40) },
    { input: rect1234, operation: resizeLeft(50), output: rect(40, 20, 10, 40) },
  ],
  () => expect(resizeLeft(rect1234, 20)).toEqual(rect(20, 20, 20, 40)),
)

describeRectOperation(
  'resizeX',
  [
    { input: rect1234, operation: resizeX(10), output: rect(10, 20, 40, 40) },
    { input: rect1234, operation: resizeX(10, 0), output: rect(10, 20, 40, 40) },
    { input: rect1234, operation: resizeX(10, 0.5), output: rect(5, 20, 40, 40) },
    { input: rect1234, operation: resizeX(10, 1), output: rect(0, 20, 40, 40) },
  ],
  () => expect(resizeX(rect1234, 10, 0.5)).toEqual(rect(5, 20, 40, 40)),
)

describeRectOperation(
  'resizeY',
  [
    { input: rect1234, operation: resizeY(10), output: rect(10, 20, 30, 50) },
    { input: rect1234, operation: resizeY(10, 0), output: rect(10, 20, 30, 50) },
    { input: rect1234, operation: resizeY(10, 0.5), output: rect(10, 15, 30, 50) },
    { input: rect1234, operation: resizeY(10, 1), output: rect(10, 10, 30, 50) },
  ],
  () => expect(resizeY(rect1234, 10, 0.5)).toEqual(rect(10, 15, 30, 50)),
)

describeRectOperation(
  'resize',
  [
    { input: rect(100), operation: resize(10, 0.5), output: rect(-5, -5, 110) },
    { input: rect(100), operation: resize(10, 1), output: rect(-10, -10, 110) },
    { input: rect(100), operation: resize(10, 0), output: rect(0, 0, 110) },
    { input: rect(100), operation: resize(point(20, 10), 0.5), output: rect(-10, -5, 120, 110) },
    { input: rect(100), operation: resize(10, point(1, 0.5)), output: rect(-10, -5, 110) },
  ],
  () => expect(resize(rect(100), 10, 0.5)).toEqual(rect(-5, -5, 110)),
)

describe('contract', () => {
  test('a number insets every edge uniformly (renamed from shrinkByOffset)', () => {
    expect(contract(rect(0, 0, 100), 10)).toEqual(rect(10, 10, 80, 80))
  })

  test('an offset insets each edge independently', () => {
    expect(contract(rect(0, 0, 100), offset.trbl(10, 20, 30, 40))).toEqual(rect(40, 10, 40, 60))
  })

  test('size floors at zero', () => {
    expect(contract(rect(0, 0, 10), 20)).toEqual(rect(20, 20, 0, 0))
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100).pipe(contract(10))).toEqual(rect(10, 10, 80, 80))
  })
})

describe('expand', () => {
  test('a number outsets every edge uniformly (renamed from growByOffset)', () => {
    expect(expand(rect(0, 0, 100), 10)).toEqual(rect(-10, -10, 120, 120))
  })

  test('an offset outsets each edge independently', () => {
    expect(expand(rect(0, 0, 100), offset.trbl(10, 20, 30, 40))).toEqual(rect(-40, -10, 160, 140))
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100).pipe(expand(10))).toEqual(rect(-10, -10, 120, 120))
  })
})

describe('join', () => {
  test('returns the enclosing hull', () => {
    expect(join(rect(), rect(10, 10, 0))).toEqual(rect(0, 0, 10))
    expect(join(rect(), rect(-10, -10, 0))).toEqual(rect(-10, -10, 10))
    expect(join(rect(10, 10, 0), rect(20, 20, 0))).toEqual(rect(10, 10, 10))
    expect(join(rect(10, 10, 0), rect(-10, -20, 0))).toEqual(rect(-10, -20, 20, 30))
  })

  test('data-last form', () => {
    expect(rect(10, 10, 0).pipe(join(rect(20, 20, 0)))).toEqual(rect(10, 10, 10))
  })
})

describe('intersect', () => {
  test('returns the overlap', () => {
    expect(intersect(rect(0, 0, 100), rect(50, 50, 100))).toEqual(rect(50, 50, 50))
    expect(intersect(rect(0, 0, 100), rect(50, 50, 25))).toEqual(rect(50, 50, 25))
  })

  test('disjoint rects collapse to the midpoint of the two centers', () => {
    expect(intersect(rect(0, 0, 100), rect(300, 0, 100))).toEqual(rect(200, 50, 0))
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100).pipe(intersect(rect(50, 50, 100)))).toEqual(rect(50, 50, 50))
  })
})

describe('contain', () => {
  test('scales self to fit inside the target', () => {
    expect(contain(rect(0, 0, 100), rect(50, 50, 100))).toEqual(rect(50, 50, 100))
    expect(contain(rect(0, 0, 100), rect(50, 50, 25))).toEqual(rect(50, 50, 25))
    expect(contain(rect(0, 0, 100, 200), rect(50, 50, 100))).toEqual(rect(75, 50, 50, 100))
  })

  test('origin distributes the leftover space', () => {
    expect(contain(rect(0, 0, 100, 200), rect(50, 50, 100), 0)).toEqual(rect(50, 50, 50, 100))
    expect(contain(rect(0, 0, 100, 200), rect(50, 50, 100), 1)).toEqual(rect(100, 50, 50, 100))
  })

  test('a zero-area self returns the target', () => {
    const target = rect(50, 50, 100)
    expect(contain(rect(), target)).toBe(target)
  })

  test('a negative-size self fits like its positive mirror (regression)', () => {
    // The factor used to go negative, placing the result outside the target.
    const target = rect(0, 0, 100, 100)
    expect(contain(rect(0, 0, -100, 200), target)).toEqual(rect(25, 0, 50, 100))
    expect(contain(rect(0, 0, 100, -200), target)).toEqual(rect(25, 0, 50, 100))
    expect(contains(target, contain(rect(0, 0, -100, 200), target))).toBe(true)
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100, 200).pipe(contain(rect(50, 50, 100)))).toEqual(rect(75, 50, 50, 100))
  })
})

describe('cover', () => {
  test('scales self to cover the target', () => {
    expect(cover(rect(0, 0, 100), rect(50, 50, 100))).toEqual(rect(50, 50, 100))
    expect(cover(rect(0, 0, 100), rect(50, 50, 25))).toEqual(rect(50, 50, 25))
    expect(cover(rect(0, 0, 100, 200), rect(50, 50, 100))).toEqual(rect(50, 0, 100, 200))
  })

  test('origin distributes the overflow', () => {
    expect(cover(rect(0, 0, 100, 200), rect(50, 50, 100), 0)).toEqual(rect(50, 50, 100, 200))
    expect(cover(rect(0, 0, 100, 200), rect(50, 50, 100), 1)).toEqual(rect(50, -50, 100, 200))
  })

  test('a zero-area self returns the target', () => {
    const target = rect(50, 50, 100)
    expect(cover(rect(), target)).toBe(target)
  })

  test('a negative-size self covers like its positive mirror (regression)', () => {
    // The factor used to go negative, producing a rect that missed the target.
    const target = rect(0, 0, 100, 100)
    expect(cover(rect(0, 0, -100, 200), target)).toEqual(rect(0, -50, 100, 200))
    expect(cover(rect(0, 0, 100, -200), target)).toEqual(rect(0, -50, 100, 200))
    expect(contains(cover(rect(0, 0, -100, 200), target), target)).toBe(true)
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100, 200).pipe(cover(rect(50, 50, 100)))).toEqual(rect(50, 0, 100, 200))
  })
})

describe('fit', () => {
  test.each([
    { mode: 'cover', origin: undefined, output: rect(50, 0, 100, 200) },
    { mode: 'cover', origin: 0, output: rect(50, 50, 100, 200) },
    { mode: 'cover', origin: 1, output: rect(50, -50, 100, 200) },
    { mode: 'contain', origin: undefined, output: rect(75, 50, 50, 100) },
    { mode: 'contain', origin: 0, output: rect(50, 50, 50, 100) },
    { mode: 'contain', origin: 1, output: rect(100, 50, 50, 100) },
    { mode: 'crop', origin: undefined, output: rect(50, 50, 50, 100) },
  ] as const)('fit($mode, $origin): $output', ({ mode, origin, output }) => {
    const result =
      origin === undefined
        ? fit(rect(0, 0, 100, 200), rect(50, 50, 100), mode)
        : fit(rect(0, 0, 100, 200), rect(50, 50, 100), mode, origin)
    expect(result).toEqual(output)
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100, 200).pipe(fit(rect(50, 50, 100), 'contain'))).toEqual(
      rect(75, 50, 50, 100),
    )
    expect(rect(0, 0, 100, 200).pipe(fit(rect(50, 50, 100), 'cover', 0))).toEqual(
      rect(50, 50, 100, 200),
    )
  })
})

describeRectOperation(
  'lerp',
  [
    { input: rect(0, 0, 100), operation: lerp(rect(100, 100, 50), 0), output: rect(0, 0, 100) },
    {
      input: rect(0, 0, 100),
      operation: lerp(rect(100, 100, 50), 0.5),
      output: rect(50, 50, 75),
    },
    { input: rect(0, 0, 100), operation: lerp(rect(100, 100, 50), 1), output: rect(100, 100, 50) },
  ],
  () => expect(lerp(rect(0, 0, 100), rect(100, 100, 50), 0.5)).toEqual(rect(50, 50, 75)),
)

describe('contains', () => {
  test('points', () => {
    expect(contains(rect(0, 0, 100), point(50, 50))).toBe(true)
    expect(contains(rect(0, 0, 100), point(0, 0))).toBe(true)
    expect(contains(rect(0, 0, 100), point(100, 100))).toBe(true)
    expect(contains(rect(0, 0, 100), point(-1, 50))).toBe(false)
    expect(contains(rect(0, 0, 100), point(50, 101))).toBe(false)
    expect(contains(rect(0, 0, 100), { x: 50, y: 50 })).toBe(true)
  })

  test('rects', () => {
    expect(contains(rect(0, 0, 100), rect(25, 25, 50))).toBe(true)
    expect(contains(rect(0, 0, 100), rect(0, 0, 100))).toBe(true)
    expect(contains(rect(0, 0, 100), rect(50, 50, 100))).toBe(false)
    expect(contains(rect(0, 0, 100), { x: 25, y: 25, width: 50, height: 50 })).toBe(true)
  })

  test('boundaries are tolerant of rounding noise', () => {
    // 0.1 + 0.2 sits an ulp above 0.3; a raw comparison would exclude it.
    expect(contains(rect(0, 0, 0.3, 1), point(0.1 + 0.2, 0.5))).toBe(true)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    expect(contains(rect(0, 0, 0.3 * 1e9, 1e9), point((0.1 + 0.2) * 1e9, 0.5 * 1e9))).toBe(true)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // The band used to become Infinity, accepting every point.
    expect(contains(rect(0, 0, Number.POSITIVE_INFINITY, 100), point(-1e9, 50))).toBe(false)
    expect(contains(rect(0, 0, Number.POSITIVE_INFINITY, 100), point(5, 50))).toBe(true)
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100).pipe(contains(point(50, 50)))).toBe(true)
  })
})

describe('intersects', () => {
  test('detects overlap', () => {
    expect(intersects(rect(0, 0, 100), rect(50, 50, 100))).toBe(true)
    expect(intersects(rect(0, 0, 100), rect(100, 0, 100))).toBe(true)
    expect(intersects(rect(0, 0, 100), rect(150, 0, 50))).toBe(false)
    expect(intersects(rect(0, 0, 100), rect(0, 150, 50))).toBe(false)
  })

  test('touching within rounding noise counts as intersecting', () => {
    expect(intersects(rect(0, 0, 0.3, 1), rect(0.1 + 0.2, 0, 1, 1))).toBe(true)
  })

  test('data-last form', () => {
    expect(rect(0, 0, 100).pipe(intersects(rect(150, 0, 50)))).toBe(false)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(equals(rect(10, 20, 30, 40), rect(10, 20, 30, 40))).toBe(true)
    expect(equals(rect(10, 20, 30, 40), rect(10, 20, 30, 41))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(rect(0.1 + 0.2, 0, 1, 1), rect(0.3, 0, 1, 1))).toBe(true)
    expect(equals(rect((0.1 + 0.2) * 1e9, 0, 1e9, 1e9), rect(0.3 * 1e9, 0, 1e9, 1e9))).toBe(true)
  })

  test('non-finite fields compare exactly (regression: verdicts were inverted)', () => {
    const halfInfinite = rect(0, 0, Number.POSITIVE_INFINITY, 10)
    expect(equals(halfInfinite, rect(0, 0, Number.POSITIVE_INFINITY, 10))).toBe(true)
    expect(equals(halfInfinite, rect(0, 0, 100, 10))).toBe(false)
    expect(equals(rect(Number.NaN, 0, 1, 1), rect(Number.NaN, 0, 1, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(rect(10, 20, 30, 40).pipe(equals(rect(10, 20, 30, 40)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits x, y, width, and height (regression: no precision field)', () => {
    expect(JSON.parse(JSON.stringify(rect(10, 20, 30, 40)))).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })
})
