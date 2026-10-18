import { describe, expect, test } from 'vitest'
import * as AspectRatio from '../src/aspectRatio.ts'
import * as Dimensions from '../src/dimensions.ts'

describe('constructors', () => {
  test('make keeps both parts', () => {
    const ratio = AspectRatio.make(16, 9)
    expect(ratio.numerator).toBe(16)
    expect(ratio.denominator).toBe(9)
    expect(ratio.value).toBe(16 / 9)
  })

  test('one argument is a ratio over 1', () => {
    expect(AspectRatio.make(2)).toEqual(AspectRatio.make(2, 1))
  })

  test('square is 1 / 1', () => {
    expect(AspectRatio.square).toEqual(AspectRatio.make(1, 1))
  })

  test('toString and toJSON', () => {
    expect(AspectRatio.make(16, 9).toString()).toBe('16 / 9')
    expect(JSON.parse(JSON.stringify(AspectRatio.make(4, 3)))).toEqual({
      numerator: 4,
      denominator: 3,
    })
  })

  test('degenerate parts give what IEEE division gives', () => {
    expect(AspectRatio.make(1, 0).value).toBe(Number.POSITIVE_INFINITY)
    expect(AspectRatio.make(0, 0).value).toBeNaN()
  })
})

describe('guards', () => {
  test.each([
    { value: AspectRatio.make(16, 9), expected: true },
    { value: 16 / 9, expected: false },
    { value: { numerator: 16, denominator: 9 }, expected: false },
    { value: null, expected: false },
  ])('isAspectRatio($value) is $expected', ({ value, expected }) => {
    expect(AspectRatio.isAspectRatio(value)).toBe(expected)
  })

  test('a ratio is never DimensionsLike', () => {
    expect(Dimensions.isDimensionsLike(AspectRatio.make(16, 9))).toBe(false)
  })
})

describe('toNumber', () => {
  test.each([
    { input: 1.5, expected: 1.5 },
    { input: AspectRatio.make(3, 2), expected: 1.5 },
    { input: AspectRatio.make(1, 4), expected: 0.25 },
  ])('$input is $expected', ({ input, expected }) => {
    expect(AspectRatio.toNumber(input)).toBe(expected)
  })
})

describe('heightFor and widthFor', () => {
  test.each([
    { ratio: 2, width: 100, height: 50 },
    { ratio: 0.25, width: 25, height: 100 },
    { ratio: AspectRatio.make(16, 9), width: 160, height: 90 },
    { ratio: AspectRatio.make(4, 3), width: 80, height: 60 },
    { ratio: AspectRatio.make(1, 2), width: 0.5, height: 1 },
  ])('$ratio: width $width <-> height $height', ({ ratio, width, height }) => {
    expect(AspectRatio.heightFor(ratio, width)).toBe(height)
    expect(AspectRatio.heightFor(width)(ratio)).toBe(height)
    expect(AspectRatio.widthFor(ratio, height)).toBe(width)
    expect(AspectRatio.widthFor(height)(ratio)).toBe(width)
  })

  test('the pipe form derives from a ratio', () => {
    expect(AspectRatio.make(4, 3).pipe(AspectRatio.heightFor(80))).toBe(60)
    expect(AspectRatio.make(4, 3).pipe(AspectRatio.widthFor(60))).toBe(80)
  })

  test('a number behaves as a ratio over 1', () => {
    for (const ratio of [16 / 9, 1.5, 3, 0.1]) {
      for (const extent of [1, 7, 100, 0.3]) {
        expect(AspectRatio.heightFor(AspectRatio.make(ratio), extent)).toBe(
          AspectRatio.heightFor(ratio, extent),
        )
        expect(AspectRatio.widthFor(AspectRatio.make(ratio), extent)).toBe(
          AspectRatio.widthFor(ratio, extent),
        )
      }
    }
  })

  test('a pair rounds once where the quotient rounds twice', () => {
    // 7 * 16 / 9 is the correctly rounded 112 / 9. The quotient 16 / 9 is
    // rounded before it scales, so it lands one ulp below.
    expect(AspectRatio.widthFor(AspectRatio.make(16, 9), 7)).toBe(112 / 9)
    expect(AspectRatio.widthFor(16 / 9, 7)).not.toBe(112 / 9)
  })

  test('integer extents derive correctly rounded results', () => {
    const ratio = AspectRatio.make(21, 9)
    for (let height = 1; height <= 200; height++) {
      expect(AspectRatio.widthFor(ratio, height)).toBe((height * 21) / 9)
    }
  })
})

describe('equals', () => {
  test.each([
    { a: AspectRatio.make(16, 9), b: AspectRatio.make(32, 18), expected: true },
    { a: AspectRatio.make(4, 3), b: AspectRatio.make(3, 4), expected: false },
    { a: AspectRatio.make(1, 3), b: AspectRatio.make(0.1, 0.3), expected: true },
    { a: AspectRatio.make(1, 0), b: AspectRatio.make(2, 0), expected: true },
    { a: AspectRatio.make(0, 0), b: AspectRatio.make(0, 0), expected: false },
  ])('$a equals $b is $expected', ({ a, b, expected }) => {
    expect(AspectRatio.equals(a, b)).toBe(expected)
    expect(a.pipe(AspectRatio.equals(b))).toBe(expected)
  })
})
