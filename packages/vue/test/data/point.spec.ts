import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { preferCachedPoint } from '../../src/data/point.ts'

describe('preferCachedPoint', () => {
  const previous = Point.make(1, 2)

  test('without a previous instance the value wins', () => {
    const value = Point.make(1, 2)

    expect(preferCachedPoint(value, undefined)).toBe(value)
  })

  test('an equal value yields the previous instance', () => {
    expect(preferCachedPoint(Point.make(1, 2), previous)).toBe(previous)
  })

  test.each([
    { name: 'x', value: Point.make(9, 2) },
    { name: 'y', value: Point.make(1, 9) },
  ])('a differing $name yields the new instance', ({ value }) => {
    expect(preferCachedPoint(value, previous)).toBe(value)
  })
})
