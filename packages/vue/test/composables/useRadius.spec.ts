import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type ComputedRef, type MaybeRefOrGetter, defineComponent, h } from 'vue'
import { type RadiusProps, useRadius } from '../../src/composables/useRadius.ts'
import { mountWithRect } from '../host.ts'

// Host rect: width 200 and height 100 are the two percent bases.
function mountRadius(
  input: MaybeRefOrGetter<RadiusProps>,
  defaultRadius?: MaybeRefOrGetter<Point.Point>,
): ComputedRef<Point.Point> {
  let radius!: ComputedRef<Point.Point>
  const Probe = defineComponent({
    name: 'Probe',
    setup() {
      radius = useRadius(input, defaultRadius)
      return () => null
    },
  })
  mountWithRect(Rect.make(0, 0, 200, 100), () => [h(Probe)])
  return radius
}

describe('resolution', () => {
  test('a number fills both components', () => {
    expect(mountRadius({ r: 10 }).value).toEqual(Point.make(10, 10))
  })

  test('a Point passes through by identity', () => {
    const point = Point.make(3, 4)

    expect(mountRadius({ r: point }).value).toBe(point)
  })

  test('an unset prop falls back to Point.zero', () => {
    expect(mountRadius({}).value).toBe(Point.zero)
  })

  test('an unset prop honors a custom default', () => {
    const fallback = Point.make(5, 6)

    expect(mountRadius({}, fallback).value).toBe(fallback)
  })
})

describe('percentages', () => {
  test('a single percentage resolves x against the parent width and mirrors it', () => {
    expect(mountRadius({ r: '50%' }).value).toEqual(Point.make(100, 100))
  })

  test('a second percentage resolves y against the parent height', () => {
    expect(mountRadius({ r: '50% 25%' }).value).toEqual(Point.make(100, 25))
  })
})
