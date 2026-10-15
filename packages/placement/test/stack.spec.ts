import { describe, expect, test } from 'vitest'
import * as Interval from '../src/interval.ts'
import * as Track from '../src/track.ts'

describe('basic', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { size: 300 },
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: {},
      result: Track.make([Interval.make(0, 0), Interval.make(0, 0)]),
    },
    {
      items: [{ basis: -100 }],
      options: {},
      result: Track.make([Interval.make(0, 0)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with stretch', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 200), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { stretch: 1 },
      result: Track.make([Interval.make(0, 200), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0 }, { basis: 200 }],
      options: { stretch: 1 },
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 150), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -0.5 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 50), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -1 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 0), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: -1.5 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 0), Interval.make(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with place', () => {
  test.each([
    {
      items: [{ basis: 100, place: 0 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(100, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 0.5 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(50, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: -1 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(-100, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 2 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(200, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 1 },
      result: Track.make([Interval.make(100, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      result: Track.make([Interval.make(50, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      result: Track.make([Interval.make(100, 100), Interval.make(50, 100), Interval.make(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with stretch and place', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1, place: 0 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 200), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 1, place: 1 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 200), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5, place: 0.5 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(25, 150), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: { place: 1 },
      result: Track.make([Interval.make(50, 150), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: { stretch: 0.5 },
      result: Track.make([Interval.make(50, 150), Interval.make(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with definite offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: 10 }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(10, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, end: 10 }, { basis: 200 }],
      options: { place: 1 },
      result: Track.make([Interval.make(90, 100), Interval.make(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('with auto offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(100, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 0 },
      result: Track.make([Interval.make(100, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 1 },
      result: Track.make([Interval.make(0, 100), Interval.make(0, 200)]),
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
      result: Track.make([Interval.make(50, 100), Interval.make(0, 200)]),
    },
  ])('stack($items, $options): $result', ({ items, options, result }) => {
    const track = Track.stack(items, options)
    expect(track).toEqual(result)
  })
})

describe('dual forms', () => {
  test('data-last form', () => {
    const operation = Track.stack({ stretch: 1 })
    expect(operation([{ basis: 100 }, { basis: 200 }])).toEqual(
      Track.make([Interval.make(0, 200), Interval.make(0, 200)]),
    )
  })
})

describe('definite offsets beside auto offsets (regression)', () => {
  // The auto-offset branch used to drop the definite start offset.
  test('a definite start offset survives an auto end offset', () => {
    const result = Track.stack([{ basis: 100, start: 10, end: Number.POSITIVE_INFINITY }], {
      size: 500,
    })
    expect(result.intervals).toEqual([Interval.make(10, 100)])
  })

  test('an auto start offset beside a definite end offset', () => {
    const result = Track.stack([{ basis: 100, start: Number.POSITIVE_INFINITY, end: 10 }], {
      size: 500,
    })
    expect(result.intervals).toEqual([Interval.make(390, 100)])
  })
})

describe('auto offsets on overflow (regression)', () => {
  // The auto-offset branch used to give each auto offset a negative share
  // of the free space and cap the item at the track size. That truncated
  // the item below its min. Now auto offsets resolve to zero on overflow
  // (as in CSS), and the min/max-clamped size stays.
  test('an overflowing auto-start item keeps its min-clamped size at offset zero', () => {
    const result = Track.stack([{ basis: 150, min: 150, start: Number.POSITIVE_INFINITY }], {
      size: 100,
    })
    expect(result.intervals).toEqual([Interval.make(0, 150)])
  })

  test('an overflowing auto-centered item keeps its clamped size with offsets zero', () => {
    const result = Track.stack(
      [{ basis: 150, start: Number.POSITIVE_INFINITY, end: Number.POSITIVE_INFINITY }],
      { size: 100 },
    )
    expect(result.intervals).toEqual([Interval.make(0, 150)])
  })
})
