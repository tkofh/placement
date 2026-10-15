import { describe, expect, test } from 'vitest'
import * as Dimensions from '../src/dimensions.ts'
import * as Interval from '../src/interval.ts'
import * as Offset from '../src/offset.ts'
import * as Point from '../src/point.ts'
import * as Rect from '../src/rect.ts'

interface RectCase {
  input: Rect.Rect
  operation: (rect: Rect.Rect) => Rect.Rect
  output: Rect.Rect
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

const zero = Rect.make()
const ten = Rect.make(10)
const thirty = Rect.make(30)
const rect1234 = Rect.make(10, 20, 30, 40)

describe('make', () => {
  test.each([
    { input: Rect.make(), output: Rect.make(0, 0, 0, 0) },
    { input: Rect.make(10), output: Rect.make(0, 0, 10, 10) },
    { input: Rect.make(10, 20), output: Rect.make(0, 0, 10, 20) },
    { input: Rect.make(10, 20, 30), output: Rect.make(10, 20, 30, 30) },
    { input: Rect.make(10, 20, 30, 40), output: Rect.make(10, 20, 30, 40) },
  ])('make($input): $output', ({ input, output }) => {
    expect(input).toEqual(output)
  })

  test('four arguments are x, y, width, and height', () => {
    const result = Rect.make(10, 20, 30, 40)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.width).toBe(30)
    expect(result.height).toBe(40)
  })

  test('constructions are exact', () => {
    expect(Rect.make(0.1, 0.2, 0.3, 0.4).width).toBe(0.3)
    expect(Rect.make(1e9 + 0.25, 0, 0.5, 0.5).right).toBe(1e9 + 0.75)
  })
})

describe('constructors', () => {
  test('zero', () => {
    expect(Rect.zero).toEqual(Rect.make(0, 0, 0, 0))
  })

  test('from copies a rect-like', () => {
    expect(Rect.from({ x: 10, y: 20, width: 30, height: 40 })).toEqual(Rect.make(10, 20, 30, 40))
    expect(Rect.from(rect1234)).toEqual(rect1234)
  })

  test('fromDimensions positions at the origin by default', () => {
    expect(Rect.fromDimensions(Dimensions.make(30, 40))).toEqual(Rect.make(0, 0, 30, 40))
  })

  test('fromDimensions takes an optional position, not a precision (regression)', () => {
    expect(Rect.fromDimensions(Dimensions.make(30, 40), Point.make(10, 20))).toEqual(
      Rect.make(10, 20, 30, 40),
    )
    // The old signature read a trailing number as a precision. Now the second
    // argument is point-like only, and inputs are stored exactly.
    expect(Rect.fromDimensions(Dimensions.make(30, 40), { x: 0.1, y: 1e9 + 0.25 }).y).toBe(
      1e9 + 0.25,
    )
  })

  test('fromInterval mirrors a single interval onto both axes', () => {
    expect(Rect.fromInterval(Interval.make(10, 30))).toEqual(Rect.make(10, 10, 30, 30))
  })

  test('fromInterval takes x and y intervals', () => {
    expect(Rect.fromInterval(Interval.make(10, 30), Interval.make(20, 40))).toEqual(
      Rect.make(10, 20, 30, 40),
    )
  })

  test('trbl spans the given edge coordinates', () => {
    expect(Rect.trbl(20, 40, 60, 10)).toEqual(Rect.make(10, 20, 30, 40))
    expect(Rect.trbl(10)).toEqual(Rect.make(10, 10, 0, 0))
    expect(Rect.trbl(10, 20)).toEqual(Rect.make(20, 10, 0, 0))
  })
})

describe('guards', () => {
  test('isRect', () => {
    expect(Rect.isRect(Rect.make())).toBe(true)
    expect(Rect.isRect({ x: 0, y: 0, width: 1, height: 1 })).toBe(false)
    expect(Rect.isRect(null)).toBe(false)
  })

  test('isRectLike', () => {
    expect(Rect.isRectLike(Rect.make())).toBe(true)
    expect(Rect.isRectLike({ x: 0, y: 0, width: 1, height: 1 })).toBe(true)
    expect(Rect.isRectLike({ x: 0, y: 0 })).toBe(false)
    expect(Rect.isRectLike(null)).toBe(false)
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
    expect(Point.isPoint(rect1234.center)).toBe(true)
    expect(rect1234.center).toEqual(Point.make(25, 40))
  })

  test('aspectRatio is exact IEEE division', () => {
    expect(Rect.make(0, 0, 100, 0).aspectRatio).toBe(Number.POSITIVE_INFINITY)
    expect(Rect.make().aspectRatio).toBeNaN()
  })
})

describeRectOperation(
  'setX',
  [
    { input: zero, operation: Rect.setX(50), output: Rect.make(50, 0, 0) },
    { input: zero, operation: Rect.setX(-50), output: Rect.make(-50, 0, 0) },
  ],
  () => expect(Rect.setX(zero, 50)).toEqual(Rect.make(50, 0, 0)),
)

describeRectOperation(
  'setY',
  [
    { input: zero, operation: Rect.setY(50), output: Rect.make(0, 50, 0) },
    { input: zero, operation: Rect.setY(-50), output: Rect.make(0, -50, 0) },
  ],
  () => expect(Rect.setY(zero, 50)).toEqual(Rect.make(0, 50, 0)),
)

describeRectOperation(
  'setPosition',
  [
    { input: zero, operation: Rect.setPosition(50), output: Rect.make(50, 50, 0) },
    { input: zero, operation: Rect.setPosition(-50), output: Rect.make(-50, -50, 0) },
    { input: zero, operation: Rect.setPosition(50, 100), output: Rect.make(50, 100, 0) },
    { input: zero, operation: Rect.setPosition(-50, 100), output: Rect.make(-50, 100, 0) },
  ],
  () => expect(Rect.setPosition(zero, 50, 100)).toEqual(Rect.make(50, 100, 0)),
)

describeRectOperation(
  'setWidth',
  [
    { input: zero, operation: Rect.setWidth(50), output: Rect.make(0, 0, 50, 0) },
    { input: zero, operation: Rect.setWidth(100), output: Rect.make(0, 0, 100, 0) },
  ],
  () => expect(Rect.setWidth(zero, 50)).toEqual(Rect.make(0, 0, 50, 0)),
)

describeRectOperation(
  'setHeight',
  [
    { input: zero, operation: Rect.setHeight(50), output: Rect.make(0, 0, 0, 50) },
    { input: zero, operation: Rect.setHeight(100), output: Rect.make(0, 0, 0, 100) },
  ],
  () => expect(Rect.setHeight(zero, 50)).toEqual(Rect.make(0, 0, 0, 50)),
)

describeRectOperation(
  'setSize',
  [
    { input: zero, operation: Rect.setSize(50), output: Rect.make(0, 0, 50) },
    { input: zero, operation: Rect.setSize(50, 100), output: Rect.make(0, 0, 50, 100) },
  ],
  () => expect(Rect.setSize(zero, 50, 100)).toEqual(Rect.make(0, 0, 50, 100)),
)

describeRectOperation(
  'setRight',
  [
    { input: zero, operation: Rect.setRight(10), output: Rect.make(10, 0, 0) },
    { input: zero, operation: Rect.setRight(-10), output: Rect.make(-10, 0, 0) },
    { input: ten, operation: Rect.setRight(20), output: Rect.make(10, 0, 10) },
    { input: ten, operation: Rect.setRight(-20), output: Rect.make(-30, 0, 10) },
  ],
  () => expect(Rect.setRight(ten, 20)).toEqual(Rect.make(10, 0, 10)),
)

describeRectOperation(
  'setBottom',
  [
    { input: zero, operation: Rect.setBottom(10), output: Rect.make(0, 10, 0) },
    { input: zero, operation: Rect.setBottom(-10), output: Rect.make(0, -10, 0) },
    { input: ten, operation: Rect.setBottom(20), output: Rect.make(0, 10, 10) },
    { input: ten, operation: Rect.setBottom(-20), output: Rect.make(0, -30, 10) },
  ],
  () => expect(Rect.setBottom(ten, 20)).toEqual(Rect.make(0, 10, 10)),
)

describeRectOperation(
  'translateX',
  [
    { input: zero, operation: Rect.translateX(10), output: Rect.make(10, 0, 0) },
    { input: zero, operation: Rect.translateX(-10), output: Rect.make(-10, 0, 0) },
  ],
  () => expect(Rect.translateX(zero, 10)).toEqual(Rect.make(10, 0, 0)),
)

describeRectOperation(
  'translateY',
  [
    { input: zero, operation: Rect.translateY(10), output: Rect.make(0, 10, 0) },
    { input: zero, operation: Rect.translateY(-10), output: Rect.make(0, -10, 0) },
  ],
  () => expect(Rect.translateY(zero, 10)).toEqual(Rect.make(0, 10, 0)),
)

describeRectOperation(
  'translate',
  [
    { input: zero, operation: Rect.translate(10, 20), output: Rect.make(10, 20, 0) },
    { input: zero, operation: Rect.translate(-10, -20), output: Rect.make(-10, -20, 0) },
  ],
  () => expect(Rect.translate(zero, 10, 20)).toEqual(Rect.make(10, 20, 0)),
)

describeRectOperation(
  'scaleX',
  [
    { input: ten, operation: Rect.scaleX(2), output: Rect.make(20, 10) },
    { input: ten, operation: Rect.scaleX(2, 0), output: Rect.make(20, 10) },
    { input: ten, operation: Rect.scaleX(2, 0.5), output: Rect.make(-5, 0, 20, 10) },
    { input: ten, operation: Rect.scaleX(2, 1), output: Rect.make(-10, 0, 20, 10) },
  ],
  () => expect(Rect.scaleX(ten, 2, 0.5)).toEqual(Rect.make(-5, 0, 20, 10)),
)

describeRectOperation(
  'scaleY',
  [
    { input: ten, operation: Rect.scaleY(2), output: Rect.make(10, 20) },
    { input: ten, operation: Rect.scaleY(2, 0), output: Rect.make(10, 20) },
    { input: ten, operation: Rect.scaleY(2, 0.5), output: Rect.make(0, -5, 10, 20) },
    { input: ten, operation: Rect.scaleY(2, 1), output: Rect.make(0, -10, 10, 20) },
  ],
  () => expect(Rect.scaleY(ten, 2, 0.5)).toEqual(Rect.make(0, -5, 10, 20)),
)

describeRectOperation(
  'scale',
  [
    { input: ten, operation: Rect.scale(2), output: Rect.make(20) },
    { input: ten, operation: Rect.scale(2, 0), output: Rect.make(20) },
    { input: ten, operation: Rect.scale(2, 0.5), output: Rect.make(-5, -5, 20) },
    { input: ten, operation: Rect.scale(2, 1), output: Rect.make(-10, -10, 20) },
  ],
  () => expect(Rect.scale(ten, 2, 1)).toEqual(Rect.make(-10, -10, 20)),
)

describeRectOperation(
  'scaleFrom',
  [
    {
      input: Rect.make(100, 100, 100),
      operation: Rect.scaleFrom(2, Point.make(100, 100)),
      output: Rect.make(100, 100, 200),
    },
    {
      input: Rect.make(100, 100, 100),
      operation: Rect.scaleFrom(2, Point.zero),
      output: Rect.make(200, 200, 200),
    },
    {
      input: Rect.make(100, 100, 100),
      operation: Rect.scaleFrom(2, Point.make(200, 200)),
      output: Rect.make(0, 0, 200),
    },
  ],
  () =>
    expect(Rect.scaleFrom(Rect.make(100, 100, 100), 2, Point.make(100, 100))).toEqual(
      Rect.make(100, 100, 200),
    ),
)

describe('clampX', () => {
  test.each([
    { input: zero, operation: Rect.clampX(10, 30), output: Rect.make(10, 0, 0) },
    // Crossed bounds: the minimum wins (CSS clamp semantics).
    { input: zero, operation: Rect.clampX(30, 10), output: Rect.make(30, 0, 0) },
    { input: zero, operation: Rect.clampX(0, 20), output: zero },
    { input: zero, operation: Rect.clampX(20, 0), output: Rect.make(20, 0, 0) },
    { input: zero, operation: Rect.clampX(-10, 10), output: zero },
    { input: zero, operation: Rect.clampX(10, -10), output: Rect.make(10, 0, 0) },
    { input: zero, operation: Rect.clampX(-20, 0), output: zero },
    { input: zero, operation: Rect.clampX(0, -20), output: zero },
    { input: zero, operation: Rect.clampX(-30, -10), output: Rect.make(-10, 0, 0) },
    { input: zero, operation: Rect.clampX(-10, -30), output: Rect.make(-10, 0, 0) },
  ])('clampX($input): $output', ({ input, operation, output }) => {
    expect(operation(input)).toEqual(output)
  })

  test('data-first form', () => {
    expect(Rect.clampX(zero, 10, 30)).toEqual(Rect.make(10, 0, 0))
  })

  test('data-last form is a single (self) => Rect closure (regression: the curried (min)(max) overload is gone)', () => {
    const operation = Rect.clampX(10, 30)
    expect(typeof operation).toBe('function')
    expect(operation(zero)).toEqual(Rect.make(10, 0, 0))
    expect(zero.pipe(operation)).toEqual(Rect.make(10, 0, 0))
  })
})

describeRectOperation(
  'clampY',
  [
    { input: zero, operation: Rect.clampY(10, 30), output: Rect.make(0, 10, 0) },
    { input: zero, operation: Rect.clampY(30, 10), output: Rect.make(0, 30, 0) },
    { input: zero, operation: Rect.clampY(0, 20), output: zero },
    { input: zero, operation: Rect.clampY(20, 0), output: Rect.make(0, 20, 0) },
    { input: zero, operation: Rect.clampY(-10, 10), output: zero },
    { input: zero, operation: Rect.clampY(10, -10), output: Rect.make(0, 10, 0) },
    { input: zero, operation: Rect.clampY(-20, 0), output: zero },
    { input: zero, operation: Rect.clampY(0, -20), output: zero },
    { input: zero, operation: Rect.clampY(-30, -10), output: Rect.make(0, -10, 0) },
    { input: zero, operation: Rect.clampY(-10, -30), output: Rect.make(0, -10, 0) },
  ],
  () => expect(Rect.clampY(zero, 10, 30)).toEqual(Rect.make(0, 10, 0)),
)

describeRectOperation(
  'clampWidth',
  [
    { input: thirty, operation: Rect.clampWidth(40, 60), output: Rect.make(40, 30) },
    { input: thirty, operation: Rect.clampWidth(60, 40), output: Rect.make(60, 30) },
    { input: thirty, operation: Rect.clampWidth(30, 50), output: Rect.make(30, 30) },
    { input: thirty, operation: Rect.clampWidth(50, 30), output: Rect.make(50, 30) },
    { input: thirty, operation: Rect.clampWidth(20, 40), output: Rect.make(30, 30) },
    { input: thirty, operation: Rect.clampWidth(40, 20), output: Rect.make(40, 30) },
    { input: thirty, operation: Rect.clampWidth(10, 30), output: Rect.make(30, 30) },
    { input: thirty, operation: Rect.clampWidth(30, 10), output: Rect.make(30, 30) },
    { input: thirty, operation: Rect.clampWidth(0, 20), output: Rect.make(20, 30) },
    { input: thirty, operation: Rect.clampWidth(20, 0), output: Rect.make(20, 30) },
  ],
  () => expect(Rect.clampWidth(thirty, 40, 60)).toEqual(Rect.make(40, 30)),
)

describeRectOperation(
  'clampHeight',
  [
    { input: thirty, operation: Rect.clampHeight(40, 60), output: Rect.make(30, 40) },
    { input: thirty, operation: Rect.clampHeight(60, 40), output: Rect.make(30, 60) },
    { input: thirty, operation: Rect.clampHeight(30, 50), output: thirty },
    { input: thirty, operation: Rect.clampHeight(50, 30), output: Rect.make(30, 50) },
    { input: thirty, operation: Rect.clampHeight(20, 40), output: thirty },
    { input: thirty, operation: Rect.clampHeight(40, 20), output: Rect.make(30, 40) },
    { input: thirty, operation: Rect.clampHeight(10, 30), output: thirty },
    { input: thirty, operation: Rect.clampHeight(30, 10), output: thirty },
    { input: thirty, operation: Rect.clampHeight(0, 20), output: Rect.make(30, 20) },
    { input: thirty, operation: Rect.clampHeight(20, 0), output: Rect.make(30, 20) },
  ],
  () => expect(Rect.clampHeight(thirty, 40, 60)).toEqual(Rect.make(30, 40)),
)

describeRectOperation(
  'alignX',
  [
    {
      input: Rect.make(100),
      operation: Rect.alignX(Rect.make(200), 0),
      output: Rect.make(0, 0, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignX(Rect.make(200), 0.5),
      output: Rect.make(50, 0, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignX(Rect.make(200), 1),
      output: Rect.make(100, 0, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignX(Rect.make(200), 1.5),
      output: Rect.make(150, 0, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignX(Rect.make(50, 60, 70, 80), 0),
      output: Rect.make(50, 0, 100),
    },
  ],
  () => expect(Rect.alignX(Rect.make(100), Rect.make(200), 0.5)).toEqual(Rect.make(50, 0, 100)),
)

describeRectOperation(
  'alignY',
  [
    {
      input: Rect.make(100),
      operation: Rect.alignY(Rect.make(200), 0),
      output: Rect.make(0, 0, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignY(Rect.make(200), 0.5),
      output: Rect.make(0, 50, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignY(Rect.make(200), 1),
      output: Rect.make(0, 100, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignY(Rect.make(200), 1.5),
      output: Rect.make(0, 150, 100),
    },
    {
      input: Rect.make(100),
      operation: Rect.alignY(Rect.make(50, 60, 70, 80), 1),
      output: Rect.make(0, 40, 100),
    },
  ],
  () => expect(Rect.alignY(Rect.make(100), Rect.make(200), 0.5)).toEqual(Rect.make(0, 50, 100)),
)

describe('align', () => {
  test('aligns both axes by a numeric origin', () => {
    expect(Rect.align(Rect.make(100), Rect.make(200), 0)).toEqual(Rect.make(0, 0, 100))
    expect(Rect.align(Rect.make(100), Rect.make(200), 0.5)).toEqual(Rect.make(50, 50, 100))
    expect(Rect.align(Rect.make(100), Rect.make(200), 1)).toEqual(Rect.make(100, 100, 100))
  })

  test('point origins align each axis independently', () => {
    expect(Rect.align(Rect.make(100), Rect.make(200), Point.make(0.5, 0))).toEqual(
      Rect.make(50, 0, 100),
    )
    expect(Rect.align(Rect.make(100), Rect.make(200), Point.make(1, 0.5))).toEqual(
      Rect.make(100, 50, 100),
    )
    expect(Rect.align(Rect.make(100), Rect.make(200), Point.make(0, 1))).toEqual(
      Rect.make(0, 100, 100),
    )
    expect(Rect.align(Rect.make(100), Rect.make(200), Point.make(0.5, 0.5))).toEqual(
      Rect.make(50, 50, 100),
    )
  })

  test('point targets have zero extent', () => {
    expect(Rect.align(Rect.make(100), Point.make(50, 60), 0)).toEqual(Rect.make(50, 60, 100))
    expect(Rect.align(Rect.make(100), Point.make(50, 60), 1)).toEqual(Rect.make(-50, -40, 100))
  })

  test('data-last form, with rect and point targets', () => {
    expect(Rect.make(100).pipe(Rect.align(Rect.make(200), 0.5))).toEqual(Rect.make(50, 50, 100))
    expect(Rect.make(100).pipe(Rect.align(Point.make(50, 60), 0.5))).toEqual(Rect.make(0, 10, 100))
  })
})

// The resize* edge cases below are the old adjust* suite translated to
// absolute edge coordinates (the edges of rect1234: left 10, top 20,
// right 40, bottom 60).
describeRectOperation(
  'resizeTop',
  [
    { input: rect1234, operation: Rect.resizeTop(20), output: rect1234 },
    { input: rect1234, operation: Rect.resizeTop(30), output: Rect.make(10, 30, 30, 30) },
    { input: rect1234, operation: Rect.resizeTop(10), output: Rect.make(10, 10, 30, 50) },
    // Crossing the fixed bottom edge flips instead of clamping.
    { input: rect1234, operation: Rect.resizeTop(70), output: Rect.make(10, 60, 30, 10) },
  ],
  () => expect(Rect.resizeTop(rect1234, 30)).toEqual(Rect.make(10, 30, 30, 30)),
)

describeRectOperation(
  'resizeRight',
  [
    { input: rect1234, operation: Rect.resizeRight(40), output: rect1234 },
    { input: rect1234, operation: Rect.resizeRight(50), output: Rect.make(10, 20, 40, 40) },
    { input: rect1234, operation: Rect.resizeRight(30), output: Rect.make(10, 20, 20, 40) },
    { input: rect1234, operation: Rect.resizeRight(0), output: Rect.make(0, 20, 10, 40) },
  ],
  () => expect(Rect.resizeRight(rect1234, 50)).toEqual(Rect.make(10, 20, 40, 40)),
)

describeRectOperation(
  'resizeBottom',
  [
    { input: rect1234, operation: Rect.resizeBottom(60), output: rect1234 },
    { input: rect1234, operation: Rect.resizeBottom(70), output: Rect.make(10, 20, 30, 50) },
    { input: rect1234, operation: Rect.resizeBottom(50), output: Rect.make(10, 20, 30, 30) },
    { input: rect1234, operation: Rect.resizeBottom(0), output: Rect.make(10, 0, 30, 20) },
  ],
  () => expect(Rect.resizeBottom(rect1234, 70)).toEqual(Rect.make(10, 20, 30, 50)),
)

describeRectOperation(
  'resizeLeft',
  [
    { input: rect1234, operation: Rect.resizeLeft(10), output: rect1234 },
    { input: rect1234, operation: Rect.resizeLeft(20), output: Rect.make(20, 20, 20, 40) },
    { input: rect1234, operation: Rect.resizeLeft(0), output: Rect.make(0, 20, 40, 40) },
    { input: rect1234, operation: Rect.resizeLeft(50), output: Rect.make(40, 20, 10, 40) },
  ],
  () => expect(Rect.resizeLeft(rect1234, 20)).toEqual(Rect.make(20, 20, 20, 40)),
)

describeRectOperation(
  'resizeX',
  [
    { input: rect1234, operation: Rect.resizeX(10), output: Rect.make(10, 20, 40, 40) },
    { input: rect1234, operation: Rect.resizeX(10, 0), output: Rect.make(10, 20, 40, 40) },
    { input: rect1234, operation: Rect.resizeX(10, 0.5), output: Rect.make(5, 20, 40, 40) },
    { input: rect1234, operation: Rect.resizeX(10, 1), output: Rect.make(0, 20, 40, 40) },
  ],
  () => expect(Rect.resizeX(rect1234, 10, 0.5)).toEqual(Rect.make(5, 20, 40, 40)),
)

describeRectOperation(
  'resizeY',
  [
    { input: rect1234, operation: Rect.resizeY(10), output: Rect.make(10, 20, 30, 50) },
    { input: rect1234, operation: Rect.resizeY(10, 0), output: Rect.make(10, 20, 30, 50) },
    { input: rect1234, operation: Rect.resizeY(10, 0.5), output: Rect.make(10, 15, 30, 50) },
    { input: rect1234, operation: Rect.resizeY(10, 1), output: Rect.make(10, 10, 30, 50) },
  ],
  () => expect(Rect.resizeY(rect1234, 10, 0.5)).toEqual(Rect.make(10, 15, 30, 50)),
)

describeRectOperation(
  'resize',
  [
    { input: Rect.make(100), operation: Rect.resize(10, 0.5), output: Rect.make(-5, -5, 110) },
    { input: Rect.make(100), operation: Rect.resize(10, 1), output: Rect.make(-10, -10, 110) },
    { input: Rect.make(100), operation: Rect.resize(10, 0), output: Rect.make(0, 0, 110) },
    {
      input: Rect.make(100),
      operation: Rect.resize(Point.make(20, 10), 0.5),
      output: Rect.make(-10, -5, 120, 110),
    },
    {
      input: Rect.make(100),
      operation: Rect.resize(10, Point.make(1, 0.5)),
      output: Rect.make(-10, -5, 110),
    },
  ],
  () => expect(Rect.resize(Rect.make(100), 10, 0.5)).toEqual(Rect.make(-5, -5, 110)),
)

describe('contract', () => {
  test('a number insets every edge uniformly (renamed from shrinkByOffset)', () => {
    expect(Rect.contract(Rect.make(0, 0, 100), 10)).toEqual(Rect.make(10, 10, 80, 80))
  })

  test('an offset insets each edge independently', () => {
    expect(Rect.contract(Rect.make(0, 0, 100), Offset.trbl(10, 20, 30, 40))).toEqual(
      Rect.make(40, 10, 40, 60),
    )
  })

  test('size floors at zero', () => {
    expect(Rect.contract(Rect.make(0, 0, 10), 20)).toEqual(Rect.make(20, 20, 0, 0))
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100).pipe(Rect.contract(10))).toEqual(Rect.make(10, 10, 80, 80))
  })
})

describe('expand', () => {
  test('a number outsets every edge uniformly (renamed from growByOffset)', () => {
    expect(Rect.expand(Rect.make(0, 0, 100), 10)).toEqual(Rect.make(-10, -10, 120, 120))
  })

  test('an offset outsets each edge independently', () => {
    expect(Rect.expand(Rect.make(0, 0, 100), Offset.trbl(10, 20, 30, 40))).toEqual(
      Rect.make(-40, -10, 160, 140),
    )
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100).pipe(Rect.expand(10))).toEqual(Rect.make(-10, -10, 120, 120))
  })
})

describe('join', () => {
  test('returns the enclosing hull', () => {
    expect(Rect.join(Rect.make(), Rect.make(10, 10, 0))).toEqual(Rect.make(0, 0, 10))
    expect(Rect.join(Rect.make(), Rect.make(-10, -10, 0))).toEqual(Rect.make(-10, -10, 10))
    expect(Rect.join(Rect.make(10, 10, 0), Rect.make(20, 20, 0))).toEqual(Rect.make(10, 10, 10))
    expect(Rect.join(Rect.make(10, 10, 0), Rect.make(-10, -20, 0))).toEqual(
      Rect.make(-10, -20, 20, 30),
    )
  })

  test('data-last form', () => {
    expect(Rect.make(10, 10, 0).pipe(Rect.join(Rect.make(20, 20, 0)))).toEqual(
      Rect.make(10, 10, 10),
    )
  })
})

describe('intersect', () => {
  test('returns the overlap', () => {
    expect(Rect.intersect(Rect.make(0, 0, 100), Rect.make(50, 50, 100))).toEqual(
      Rect.make(50, 50, 50),
    )
    expect(Rect.intersect(Rect.make(0, 0, 100), Rect.make(50, 50, 25))).toEqual(
      Rect.make(50, 50, 25),
    )
  })

  test('disjoint rects collapse to the midpoint of the two centers', () => {
    expect(Rect.intersect(Rect.make(0, 0, 100), Rect.make(300, 0, 100))).toEqual(
      Rect.make(200, 50, 0),
    )
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100).pipe(Rect.intersect(Rect.make(50, 50, 100)))).toEqual(
      Rect.make(50, 50, 50),
    )
  })
})

describe('contain', () => {
  test('scales self to fit inside the target', () => {
    expect(Rect.contain(Rect.make(0, 0, 100), Rect.make(50, 50, 100))).toEqual(
      Rect.make(50, 50, 100),
    )
    expect(Rect.contain(Rect.make(0, 0, 100), Rect.make(50, 50, 25))).toEqual(Rect.make(50, 50, 25))
    expect(Rect.contain(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100))).toEqual(
      Rect.make(75, 50, 50, 100),
    )
  })

  test('origin distributes the leftover space', () => {
    expect(Rect.contain(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 0)).toEqual(
      Rect.make(50, 50, 50, 100),
    )
    expect(Rect.contain(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 1)).toEqual(
      Rect.make(100, 50, 50, 100),
    )
  })

  test('a zero-area self returns the target', () => {
    const target = Rect.make(50, 50, 100)
    expect(Rect.contain(Rect.make(), target)).toBe(target)
  })

  test('a negative-size self fits like its positive mirror (regression)', () => {
    // The factor used to go negative, placing the result outside the target.
    const target = Rect.make(0, 0, 100, 100)
    expect(Rect.contain(Rect.make(0, 0, -100, 200), target)).toEqual(Rect.make(25, 0, 50, 100))
    expect(Rect.contain(Rect.make(0, 0, 100, -200), target)).toEqual(Rect.make(25, 0, 50, 100))
    expect(Rect.contains(target, Rect.contain(Rect.make(0, 0, -100, 200), target))).toBe(true)
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100, 200).pipe(Rect.contain(Rect.make(50, 50, 100)))).toEqual(
      Rect.make(75, 50, 50, 100),
    )
  })
})

describe('cover', () => {
  test('scales self to cover the target', () => {
    expect(Rect.cover(Rect.make(0, 0, 100), Rect.make(50, 50, 100))).toEqual(Rect.make(50, 50, 100))
    expect(Rect.cover(Rect.make(0, 0, 100), Rect.make(50, 50, 25))).toEqual(Rect.make(50, 50, 25))
    expect(Rect.cover(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100))).toEqual(
      Rect.make(50, 0, 100, 200),
    )
  })

  test('origin distributes the overflow', () => {
    expect(Rect.cover(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 0)).toEqual(
      Rect.make(50, 50, 100, 200),
    )
    expect(Rect.cover(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 1)).toEqual(
      Rect.make(50, -50, 100, 200),
    )
  })

  test('a zero-area self returns the target', () => {
    const target = Rect.make(50, 50, 100)
    expect(Rect.cover(Rect.make(), target)).toBe(target)
  })

  test('a negative-size self covers like its positive mirror (regression)', () => {
    // The factor used to go negative, producing a rect that missed the target.
    const target = Rect.make(0, 0, 100, 100)
    expect(Rect.cover(Rect.make(0, 0, -100, 200), target)).toEqual(Rect.make(0, -50, 100, 200))
    expect(Rect.cover(Rect.make(0, 0, 100, -200), target)).toEqual(Rect.make(0, -50, 100, 200))
    expect(Rect.contains(Rect.cover(Rect.make(0, 0, -100, 200), target), target)).toBe(true)
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100, 200).pipe(Rect.cover(Rect.make(50, 50, 100)))).toEqual(
      Rect.make(50, 0, 100, 200),
    )
  })
})

describe('fit', () => {
  test.each([
    { mode: 'cover', origin: undefined, output: Rect.make(50, 0, 100, 200) },
    { mode: 'cover', origin: 0, output: Rect.make(50, 50, 100, 200) },
    { mode: 'cover', origin: 1, output: Rect.make(50, -50, 100, 200) },
    { mode: 'contain', origin: undefined, output: Rect.make(75, 50, 50, 100) },
    { mode: 'contain', origin: 0, output: Rect.make(50, 50, 50, 100) },
    { mode: 'contain', origin: 1, output: Rect.make(100, 50, 50, 100) },
    { mode: 'crop', origin: undefined, output: Rect.make(50, 50, 50, 100) },
  ] as const)('fit($mode, $origin): $output', ({ mode, origin, output }) => {
    const result =
      origin === undefined
        ? Rect.fit(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), mode)
        : Rect.fit(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), mode, origin)
    expect(result).toEqual(output)
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100, 200).pipe(Rect.fit(Rect.make(50, 50, 100), 'contain'))).toEqual(
      Rect.make(75, 50, 50, 100),
    )
    expect(Rect.make(0, 0, 100, 200).pipe(Rect.fit(Rect.make(50, 50, 100), 'cover', 0))).toEqual(
      Rect.make(50, 50, 100, 200),
    )
  })
})

describeRectOperation(
  'lerp',
  [
    {
      input: Rect.make(0, 0, 100),
      operation: Rect.lerp(Rect.make(100, 100, 50), 0),
      output: Rect.make(0, 0, 100),
    },
    {
      input: Rect.make(0, 0, 100),
      operation: Rect.lerp(Rect.make(100, 100, 50), 0.5),
      output: Rect.make(50, 50, 75),
    },
    {
      input: Rect.make(0, 0, 100),
      operation: Rect.lerp(Rect.make(100, 100, 50), 1),
      output: Rect.make(100, 100, 50),
    },
  ],
  () =>
    expect(Rect.lerp(Rect.make(0, 0, 100), Rect.make(100, 100, 50), 0.5)).toEqual(
      Rect.make(50, 50, 75),
    ),
)

describe('localize / normalize / denormalize', () => {
  const self = Rect.make(100, 50, 200, 100)

  test.each([
    ['localize', Rect.localize, Point.make(150, 75), Point.make(50, 25)],
    ['normalize', Rect.normalize, Point.make(150, 75), Point.make(0.25, 0.25)],
    ['denormalize', Rect.denormalize, Point.make(0.25, 0.25), Point.make(150, 75)],
  ] as const)('%s maps a point, in both forms', (_, op, target, expected) => {
    expect(op(self, target)).toEqual(expected)
    expect(self.pipe(op(target))).toEqual(expected)
  })

  test.each([
    ['localize', Rect.localize, Rect.make(150, 75, 50, 25), Rect.make(50, 25, 50, 25)],
    ['normalize', Rect.normalize, Rect.make(150, 75, 50, 25), Rect.make(0.25, 0.25, 0.25, 0.25)],
    [
      'denormalize',
      Rect.denormalize,
      Rect.make(0.25, 0.25, 0.25, 0.25),
      Rect.make(150, 75, 50, 25),
    ],
  ] as const)('%s maps a rect, in both forms', (_, op, target, expected) => {
    expect(op(self, target)).toEqual(expected)
    expect(self.pipe(op(target))).toEqual(expected)
  })

  test('plain records dispatch on shape', () => {
    expect(Rect.localize(self, { x: 100, y: 50 })).toEqual(Point.zero)
    expect(Rect.localize(self, { x: 100, y: 50, width: 1, height: 2 })).toEqual(
      Rect.make(0, 0, 1, 2),
    )
  })

  test('denormalize inverts normalize', () => {
    const odd = Rect.make(0.1, 0.2, 0.3, 0.7)
    const point = Point.make(0.15, 0.6)
    const roundTrip = Rect.denormalize(odd, Rect.normalize(odd, point))
    expect(roundTrip.x).toBeCloseTo(point.x, 12)
    expect(roundTrip.y).toBeCloseTo(point.y, 12)
  })

  test('denormalize of Point.half is the center', () => {
    expect(Rect.denormalize(self, Point.half)).toEqual(self.center)
  })

  test('normalize against a zero-size axis follows IEEE division', () => {
    const flat = Rect.make(0, 0, 100, 0)
    expect(Rect.normalize(flat, Point.make(50, 10))).toEqual(
      Point.make(0.5, Number.POSITIVE_INFINITY),
    )
    expect(Rect.normalize(flat, Point.make(50, 0)).y).toBeNaN()
  })
})

describe('contains', () => {
  test('points', () => {
    expect(Rect.contains(Rect.make(0, 0, 100), Point.make(50, 50))).toBe(true)
    expect(Rect.contains(Rect.make(0, 0, 100), Point.make(0, 0))).toBe(true)
    expect(Rect.contains(Rect.make(0, 0, 100), Point.make(100, 100))).toBe(true)
    expect(Rect.contains(Rect.make(0, 0, 100), Point.make(-1, 50))).toBe(false)
    expect(Rect.contains(Rect.make(0, 0, 100), Point.make(50, 101))).toBe(false)
    expect(Rect.contains(Rect.make(0, 0, 100), { x: 50, y: 50 })).toBe(true)
  })

  test('rects', () => {
    expect(Rect.contains(Rect.make(0, 0, 100), Rect.make(25, 25, 50))).toBe(true)
    expect(Rect.contains(Rect.make(0, 0, 100), Rect.make(0, 0, 100))).toBe(true)
    expect(Rect.contains(Rect.make(0, 0, 100), Rect.make(50, 50, 100))).toBe(false)
    expect(Rect.contains(Rect.make(0, 0, 100), { x: 25, y: 25, width: 50, height: 50 })).toBe(true)
  })

  test('boundaries are tolerant of rounding noise', () => {
    // 0.1 + 0.2 is an ulp above 0.3. Without tolerance, the comparison excludes it.
    expect(Rect.contains(Rect.make(0, 0, 0.3, 1), Point.make(0.1 + 0.2, 0.5))).toBe(true)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    expect(
      Rect.contains(Rect.make(0, 0, 0.3 * 1e9, 1e9), Point.make((0.1 + 0.2) * 1e9, 0.5 * 1e9)),
    ).toBe(true)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // The band used to become Infinity, accepting every point.
    expect(
      Rect.contains(Rect.make(0, 0, Number.POSITIVE_INFINITY, 100), Point.make(-1e9, 50)),
    ).toBe(false)
    expect(Rect.contains(Rect.make(0, 0, Number.POSITIVE_INFINITY, 100), Point.make(5, 50))).toBe(
      true,
    )
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100).pipe(Rect.contains(Point.make(50, 50)))).toBe(true)
  })
})

describe('intersects', () => {
  test('detects overlap', () => {
    expect(Rect.intersects(Rect.make(0, 0, 100), Rect.make(50, 50, 100))).toBe(true)
    expect(Rect.intersects(Rect.make(0, 0, 100), Rect.make(100, 0, 100))).toBe(true)
    expect(Rect.intersects(Rect.make(0, 0, 100), Rect.make(150, 0, 50))).toBe(false)
    expect(Rect.intersects(Rect.make(0, 0, 100), Rect.make(0, 150, 50))).toBe(false)
  })

  test('touching within rounding noise counts as intersecting', () => {
    expect(Rect.intersects(Rect.make(0, 0, 0.3, 1), Rect.make(0.1 + 0.2, 0, 1, 1))).toBe(true)
  })

  test('data-last form', () => {
    expect(Rect.make(0, 0, 100).pipe(Rect.intersects(Rect.make(150, 0, 50)))).toBe(false)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(Rect.equals(Rect.make(10, 20, 30, 40), Rect.make(10, 20, 30, 40))).toBe(true)
    expect(Rect.equals(Rect.make(10, 20, 30, 40), Rect.make(10, 20, 30, 41))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(Rect.equals(Rect.make(0.1 + 0.2, 0, 1, 1), Rect.make(0.3, 0, 1, 1))).toBe(true)
    expect(
      Rect.equals(Rect.make((0.1 + 0.2) * 1e9, 0, 1e9, 1e9), Rect.make(0.3 * 1e9, 0, 1e9, 1e9)),
    ).toBe(true)
  })

  test('non-finite fields compare exactly (regression: verdicts were inverted)', () => {
    const halfInfinite = Rect.make(0, 0, Number.POSITIVE_INFINITY, 10)
    expect(Rect.equals(halfInfinite, Rect.make(0, 0, Number.POSITIVE_INFINITY, 10))).toBe(true)
    expect(Rect.equals(halfInfinite, Rect.make(0, 0, 100, 10))).toBe(false)
    expect(Rect.equals(Rect.make(Number.NaN, 0, 1, 1), Rect.make(Number.NaN, 0, 1, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(Rect.make(10, 20, 30, 40).pipe(Rect.equals(Rect.make(10, 20, 30, 40)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits x, y, width, and height (regression: no precision field)', () => {
    expect(JSON.parse(JSON.stringify(Rect.make(10, 20, 30, 40)))).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })
})
