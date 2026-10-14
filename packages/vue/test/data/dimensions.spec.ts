import * as Dimensions from 'placement/dimensions'
import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { autoDimensions, computedDimensions } from '../../src/data/dimensions.ts'

describe('computedDimensions', () => {
  test('builds Dimensions from its getters', () => {
    const dimensions = computedDimensions(
      () => 10,
      () => 20,
    )

    expect(dimensions.value).toEqual(Dimensions.make(10, 20))
  })

  test('an equal recompute returns the previous instance', () => {
    const source = ref({ w: 10, h: 20 })
    let runs = 0
    const dimensions = computedDimensions(
      () => {
        runs++
        return source.value.w
      },
      () => source.value.h,
    )

    const first = dimensions.value
    expect(runs).toBe(1)

    // A new object identity invalidates the computed; the equal result keeps
    // the cached instance.
    source.value = { w: 10, h: 20 }
    expect(dimensions.value).toBe(first)
    expect(runs).toBe(2)

    source.value = { w: 10, h: 30 }
    expect(dimensions.value).not.toBe(first)
    expect(dimensions.value).toEqual(Dimensions.make(10, 30))
    expect(runs).toBe(3)
  })
})

describe('autoDimensions', () => {
  test.each([
    {
      name: 'finite extents win',
      first: Dimensions.make(10, 20),
      second: Dimensions.make(1, 2),
      expected: Dimensions.make(10, 20),
    },
    {
      name: 'an infinite extent falls through per axis',
      first: Dimensions.make(Number.POSITIVE_INFINITY, 20),
      second: Dimensions.make(1, 2),
      expected: Dimensions.make(1, 20),
    },
    {
      name: 'both axes fall through',
      first: Dimensions.infinity,
      second: Dimensions.make(1, 2),
      expected: Dimensions.make(1, 2),
    },
  ])('$name', ({ first, second, expected }) => {
    expect(autoDimensions(first, second)).toEqual(expected)
  })

  test('when neither extent is finite, the last candidate wins', () => {
    const result = autoDimensions(Dimensions.make(Number.NaN, 1), Dimensions.infinity)

    expect(result.width).toBe(Number.POSITIVE_INFINITY)
    expect(result.height).toBe(1)
  })
})
