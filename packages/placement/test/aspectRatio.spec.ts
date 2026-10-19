import { describe, expect, test } from 'vitest'
import * as AspectRatio from '../src/aspectRatio.ts'

describe('isAspectRatio', () => {
  test.each<[unknown, boolean]>([
    [1.5, true],
    [0, true],
    [Number.NaN, true],
    [[16, 9], true],
    [[1, 0], true],
    [[16], false],
    [[16, 9, 1], false],
    [[16, '9'], false],
    ['16 / 9', false],
    [{ 0: 16, 1: 9, length: 2 }, false],
    [undefined, false],
    [null, false],
  ])('%j is %s', (value, expected) => {
    expect(AspectRatio.isAspectRatio(value)).toBe(expected)
  })
})

describe('toNumber', () => {
  test.each<[AspectRatio.AspectRatio, number]>([
    [1.5, 1.5],
    [[3, 2], 1.5],
    [[1, 4], 0.25],
    [[16, 9], 16 / 9],
  ])('%j is %d', (ratio, expected) => {
    expect(AspectRatio.toNumber(ratio)).toBe(expected)
  })

  test('degenerate pairs give what IEEE division gives', () => {
    expect(AspectRatio.toNumber([1, 0])).toBe(Number.POSITIVE_INFINITY)
    expect(AspectRatio.toNumber([0, 0])).toBeNaN()
  })
})

describe('heightFor and widthFor', () => {
  test.each<[AspectRatio.AspectRatio, number, number]>([
    [2, 100, 50],
    [0.25, 25, 100],
    [[16, 9], 160, 90],
    [[4, 3], 80, 60],
    [[1, 2], 0.5, 1],
  ])('%j: width %d <-> height %d', (ratio, width, height) => {
    expect(AspectRatio.heightFor(ratio, width)).toBe(height)
    expect(AspectRatio.widthFor(ratio, height)).toBe(width)
  })

  test('a number behaves as a pair over 1', () => {
    for (const ratio of [16 / 9, 1.5, 3, 0.1]) {
      for (const extent of [1, 7, 100, 0.3]) {
        expect(AspectRatio.heightFor([ratio, 1], extent)).toBe(AspectRatio.heightFor(ratio, extent))
        expect(AspectRatio.widthFor([ratio, 1], extent)).toBe(AspectRatio.widthFor(ratio, extent))
      }
    }
  })

  test('a pair rounds once where the quotient rounds twice', () => {
    // 7 * 16 / 9 is the correctly rounded 112 / 9. The quotient 16 / 9 is
    // rounded before it scales, so it lands one ulp below.
    expect(AspectRatio.widthFor([16, 9], 7)).toBe(112 / 9)
    expect(AspectRatio.widthFor(16 / 9, 7)).not.toBe(112 / 9)
  })

  test('integer extents derive correctly rounded results', () => {
    for (let height = 1; height <= 200; height++) {
      expect(AspectRatio.widthFor([21, 9], height)).toBe((height * 21) / 9)
    }
  })
})
