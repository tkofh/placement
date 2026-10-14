import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import type { OriginInput } from '../../src/internal/props/origin.ts'
import { useOrigin } from '../../src/props/origin.ts'

describe('useOrigin', () => {
  test('undefined resolves to the fallback point itself', () => {
    expect(useOrigin(() => undefined).value).toBe(Point.zero)

    const fallback = Point.make(0.25, 0.75)
    expect(useOrigin(() => undefined, fallback).value).toBe(fallback)
  })

  test('a Point input passes through by identity', () => {
    const point = Point.make(0.25, 0.5)

    expect(useOrigin(() => point).value).toBe(point)
  })

  test('a number applies to both axes', () => {
    expect(useOrigin(() => 0.25).value).toEqual(Point.make(0.25, 0.25))
  })

  test('equivalent forms keep the cached instance', () => {
    const input = ref<OriginInput>('center')
    const origin = useOrigin(input)

    const first = origin.value
    expect(first).toEqual(Point.make(0.5, 0.5))

    // A different string resolving to an equal point: recomputed, same
    // instance.
    input.value = '50%'
    expect(origin.value).toBe(first)

    input.value = 'left'
    expect(origin.value).not.toBe(first)
    expect(origin.value).toEqual(Point.make(0, 0.5))
  })
})
