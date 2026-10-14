import * as Interval from 'placement/interval'
import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { computedInterval } from '../../src/data/interval.ts'

describe('computedInterval', () => {
  test('builds an Interval from its getters', () => {
    const interval = computedInterval(
      () => 10,
      () => 20,
    )

    expect(interval.value).toEqual(Interval.make(10, 20))
    expect(interval.value.end).toBe(30)
  })

  test('an equal recompute returns the previous instance', () => {
    const source = ref({ start: 10, size: 20 })
    let runs = 0
    const interval = computedInterval(
      () => {
        runs++
        return source.value.start
      },
      () => source.value.size,
    )

    const first = interval.value
    expect(runs).toBe(1)

    // A new object identity invalidates the computed; the equal result keeps
    // the cached instance.
    source.value = { start: 10, size: 20 }
    expect(interval.value).toBe(first)
    expect(runs).toBe(2)

    source.value = { start: 10, size: 30 }
    expect(interval.value).not.toBe(first)
    expect(interval.value).toEqual(Interval.make(10, 30))
    expect(runs).toBe(3)
  })

  test('a changed start with the same size is a new instance', () => {
    const start = ref(0)
    const interval = computedInterval(start, () => 20)
    const first = interval.value

    start.value = 5
    expect(interval.value).not.toBe(first)
    expect(interval.value).toEqual(Interval.make(5, 20))
  })
})
