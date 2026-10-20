import { describe, expect, test } from 'vitest'
import * as Sizing from '../src/sizing.ts'

const unset = Number.NaN
const Inf = Number.POSITIVE_INFINITY

describe('normalize', () => {
  test('omitted fields are unset', () => {
    expect(Sizing.normalize({})).toEqual({
      width: unset,
      height: unset,
      aspectRatio: undefined,
      minWidth: 0,
      minHeight: 0,
      maxWidth: Inf,
      maxHeight: Inf,
    })
  })

  test.each([unset, Inf, -Inf])('a size or bound of %f is unset', (value) => {
    expect(
      Sizing.normalize({
        width: value,
        height: value,
        minWidth: value,
        minHeight: value,
        maxWidth: value,
        maxHeight: value,
      }),
    ).toEqual(Sizing.normalize({}))
  })

  test('negative bounds clamp to 0, and a crossed maximum rises to its minimum', () => {
    const sizing = Sizing.normalize({ minWidth: -5, maxWidth: -1, minHeight: 20, maxHeight: 10 })
    expect([sizing.minWidth, sizing.maxWidth, sizing.minHeight, sizing.maxHeight]).toEqual([
      0, 0, 20, 20,
    ])
  })

  test('negative sizes are kept for the bounds to clamp', () => {
    expect(Sizing.normalize({ width: -10 }).width).toBe(-10)
  })

  test.each([0, -2, unset, Inf, [0, 9] as const, [16, -9] as const])(
    'a ratio of %j is unset',
    (aspectRatio) => {
      expect(Sizing.normalize({ aspectRatio }).aspectRatio).toBeUndefined()
    },
  )

  test('a valid ratio is kept as given', () => {
    expect(Sizing.normalize({ aspectRatio: [16, 9] }).aspectRatio).toEqual([16, 9])
  })
})

describe('resolve', () => {
  const zero = { width: 0, height: 0 }

  test.each([
    ['nothing set', {}, zero, [0, 0]],
    ['nothing set, sizes supplied', {}, { width: 30, height: 40 }, [30, 40]],
    ['both set', { width: 10, height: 20 }, zero, [10, 20]],
    ['the width set, with a ratio', { width: 100, aspectRatio: 2 }, zero, [100, 50]],
    ['the height set, with a ratio', { height: 50, aspectRatio: 2 }, zero, [100, 50]],
    ['both set, with a ratio', { width: 10, height: 20, aspectRatio: 2 }, zero, [10, 20]],
    ['a ratio alone', { aspectRatio: 2 }, zero, [0, 0]],
    ['a ratio and a minimum width', { aspectRatio: 2, minWidth: 40 }, zero, [40, 20]],
    ['a ratio and a minimum height', { aspectRatio: 2, minHeight: 40 }, zero, [80, 40]],
    ['a ratio and supplied sizes', { aspectRatio: 2 }, { width: 30, height: 40 }, [30, 15]],
    [
      'a size clamped before the ratio',
      { width: 100, maxWidth: 60, aspectRatio: 2 },
      zero,
      [60, 30],
    ],
    ['a derived size clamped', { width: 100, aspectRatio: 2, maxHeight: 10 }, zero, [100, 10]],
    ['crossed bounds', { width: 5, minWidth: 20, maxWidth: 10 }, zero, [20, 0]],
  ] as const)('%s', (_, input, supplied, [width, height]) => {
    expect(Sizing.resolve(Sizing.normalize(input), supplied)).toEqual({ width, height })
  })

  test('a fixed axis overrides the preferred size and drives the ratio', () => {
    const sizing = Sizing.normalize({ width: 10, height: 20, aspectRatio: 2 })
    expect(Sizing.resolve(sizing, { width: 0, height: 80, definiteHeight: true })).toEqual({
      width: 10,
      height: 80,
    })
    const unset = Sizing.normalize({ height: 20, aspectRatio: 2, maxHeight: 60 })
    expect(Sizing.resolve(unset, { width: 0, height: 80, definiteHeight: true })).toEqual({
      width: 120,
      height: 60,
    })
  })

  test('fixed sizes on both axes leave the ratio no effect', () => {
    const sizing = Sizing.normalize({ aspectRatio: 2 })
    expect(
      Sizing.resolve(sizing, { width: 30, height: 40, definiteWidth: true, definiteHeight: true }),
    ).toEqual({ width: 30, height: 40 })
  })

  test('a pair ratio derives with one rounding', () => {
    const sizing = Sizing.normalize({ height: 7, aspectRatio: [16, 9] })
    expect(Sizing.resolve(sizing, { width: 0, height: 0 }).width).toBe((7 * 16) / 9)
  })
})

describe('fields', () => {
  test('names each field once, with its percentage axis', () => {
    expect(Sizing.fields).toEqual({
      width: 'x',
      height: 'y',
      aspectRatio: 'ratio',
      minWidth: 'x',
      minHeight: 'y',
      maxWidth: 'x',
      maxHeight: 'y',
    })
  })
})
