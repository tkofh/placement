import * as Offset from 'placement/offset'
import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { computedTRBLOffset, preferCachedOffset } from '../../src/data/offset.ts'

describe('preferCachedOffset', () => {
  const previous = Offset.trbl(1, 2, 3, 4)

  test('without a previous instance the value wins', () => {
    const value = Offset.trbl(1, 2, 3, 4)

    expect(preferCachedOffset(value, undefined)).toBe(value)
  })

  test('an equal value yields the previous instance', () => {
    expect(preferCachedOffset(Offset.trbl(1, 2, 3, 4), previous)).toBe(previous)
  })

  test.each([
    { name: 'top', value: Offset.trbl(9, 2, 3, 4) },
    { name: 'right', value: Offset.trbl(1, 9, 3, 4) },
    { name: 'bottom', value: Offset.trbl(1, 2, 9, 4) },
    { name: 'left', value: Offset.trbl(1, 2, 3, 9) },
  ])('a differing $name yields the new instance', ({ value }) => {
    expect(preferCachedOffset(value, previous)).toBe(value)
  })
})

describe('computedTRBLOffset', () => {
  test('builds an Offset from its getters', () => {
    const offset = computedTRBLOffset(
      () => 1,
      () => 2,
      () => 3,
      () => 4,
    )

    expect(offset.value).toEqual(Offset.trbl(1, 2, 3, 4))
  })

  test('an equal recompute returns the previous instance', () => {
    const source = ref({ t: 1, r: 2, b: 3, l: 4 })
    let runs = 0
    const offset = computedTRBLOffset(
      () => {
        runs++
        return source.value.t
      },
      () => source.value.r,
      () => source.value.b,
      () => source.value.l,
    )

    const first = offset.value
    expect(runs).toBe(1)

    // A new object identity invalidates the computed; the equal result keeps
    // the cached instance.
    source.value = { t: 1, r: 2, b: 3, l: 4 }
    expect(offset.value).toBe(first)
    expect(runs).toBe(2)

    source.value = { t: 1, r: 2, b: 3, l: 5 }
    expect(offset.value).not.toBe(first)
    expect(offset.value).toEqual(Offset.trbl(1, 2, 3, 5))
    expect(runs).toBe(3)
  })
})
