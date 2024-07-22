import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { stack, track } from '../src/track'

describe('basic', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { size: 300 },
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: {},
      result: track([interval(0, 0), interval(0, 0)]),
    },
    {
      items: [{ basis: -100 }],
      options: {},
      result: track([interval(0, 0)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with stretch', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 200), interval(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { stretch: 1 },
      result: track([interval(0, 200), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0 }, { basis: 200 }],
      options: { stretch: 1 },
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 150), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -0.5 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 50), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -1 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 0), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -1.5 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 0), interval(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('wth place', () => {
  test.each([
    {
      items: [{ basis: 100, place: 0 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: {},
      result: track([interval(100, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 0.5 }, { basis: 200 }],
      options: {},
      result: track([interval(50, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: -1 }, { basis: 200 }],
      options: {},
      result: track([interval(-100, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 2 }, { basis: 200 }],
      options: {},
      result: track([interval(200, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 1 },
      result: track([interval(100, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      result: track([interval(50, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      result: track([interval(100, 100), interval(50, 100), interval(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with stretch and place', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1, place: 0 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 200), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 1, place: 1 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 200), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5, place: 0.5 }, { basis: 200 }],
      options: {},
      result: track([interval(25, 150), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: { place: 1 },
      result: track([interval(50, 150), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: { stretch: 0.5 },
      result: track([interval(50, 150), interval(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with definite offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: 10 }, { basis: 200 }],
      options: {},
      result: track([interval(10, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, end: 10 }, { basis: 200 }],
      options: { place: 1 },
      result: track([interval(90, 100), interval(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with auto offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      result: track([interval(100, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 0 },
      result: track([interval(100, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 1 },
      result: track([interval(0, 100), interval(0, 200)]),
    },
    {
      items: [
        {
          basis: 100,
          start: Number.POSITIVE_INFINITY,
          end: Number.POSITIVE_INFINITY,
        },
        { basis: 200 },
      ],
      options: {},
      result: track([interval(50, 100), interval(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = stack(items, options)
    expect(track).toEqual(result)
  })
})
