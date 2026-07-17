import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval.ts'
import { sequence, track } from '../src/track.ts'

describe('basic cases', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: {},
      result: track([interval(0, 100), interval(100, 100)]),
    },
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: { size: Number.POSITIVE_INFINITY },
      result: track([interval(0, 100), interval(100, 100)]),
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
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(100, 200)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100, start: 50 }],
      options: {},
      result: track([interval(0, 100), interval(150, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: {},
      result: track([interval(0, 100), interval(150, 100)]),
    },
    {
      items: [
        { basis: 100, end: 50 },
        { basis: 100, start: 50 },
      ],
      options: {},
      result: track([interval(0, 100), interval(200, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(100, 200)]),
    },
    {
      items: [{ basis: 100, grow: 1 }, { basis: 200 }],
      options: { size: 400 },
      result: track([interval(0, 200), interval(200, 200)]),
    },
    {
      items: [
        { basis: 100, grow: 1 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      result: track([interval(0, 200), interval(200, 200)]),
    },
    {
      items: [
        { basis: 100, grow: 3 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      result: track([interval(0, 250), interval(250, 150)]),
    },
    {
      items: [
        { basis: 100, grow: 1 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 150 },
      result: track([interval(0, 100), interval(100, 100)]),
    },
    {
      items: [
        { basis: 100, grow: 3, max: 200 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      result: track([interval(0, 200), interval(200, 200)]),
    },
    {
      items: [
        { basis: 50, grow: 3, max: 100 },
        { basis: 50, grow: 3 },
        { basis: 50, grow: 1 },
      ],
      options: { size: 400 },
      result: track([interval(0, 100), interval(100, 200), interval(300, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow ratio', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1 }, { basis: 100 }],
      options: { growRatio: 0, size: 300 },
      result: track([interval(0, 100), interval(100, 100)]),
    },
    {
      items: [{ basis: 100, grow: 1 }, { basis: 100 }],
      options: { growRatio: 0.5, size: 300 },
      result: track([interval(0, 150), interval(150, 100)]),
    },
    {
      items: [{ basis: 100, grow: 1 }, { basis: 100 }],
      options: { growRatio: 1, size: 300 },
      result: track([interval(0, 200), interval(200, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with shrink', () => {
  test.each([
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 200 }],
      options: {},
      result: track([interval(0, 100), interval(100, 200)]),
    },
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 200 }],
      options: { size: 200 },
      result: track([interval(0, 0), interval(0, 200)]),
    },
    {
      items: [
        { basis: 100, shrink: 1 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      result: track([interval(0, 50), interval(50, 50)]),
    },
    {
      items: [
        { basis: 100, shrink: 1 },
        { basis: 200, shrink: 1 },
      ],
      options: { size: 200 },
      result: track([interval(0, (100 / 3) * 2), interval((100 / 3) * 2, 100 + 100 / 3)]),
    },
    {
      items: [
        { basis: 100, shrink: 1, min: 75 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      result: track([interval(0, 75), interval(75, 25)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })

  test('2:1 shrink shares land within rounding distance of exact thirds', () => {
    // The shares put thirds through cancellation; construction is exact
    // IEEE, so the result carries an ulp of rounding (see PRECISION.md).
    const result = sequence(
      [
        { basis: 100, shrink: 2 },
        { basis: 100, shrink: 1 },
      ],
      { size: 100 },
    )
    const [first, second] = result.intervals
    expect(first?.start).toBe(0)
    expect(first?.size).toBeCloseTo(100 / 3, 10)
    expect(second?.start).toBeCloseTo(100 / 3, 10)
    expect(second?.size).toBeCloseTo((100 / 3) * 2, 10)
  })
})

describe('with shrink ratio', () => {
  test.each([
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 100 }],
      options: { shrinkRatio: 0, size: 100 },
      result: track([interval(0, 100), interval(100, 100)]),
    },
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 100 }],
      options: { shrinkRatio: 0.5, size: 100 },
      result: track([interval(0, 50), interval(50, 100)]),
    },
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 100 }],
      options: { shrinkRatio: 1, size: 100 },
      result: track([interval(0, 0), interval(0, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with gap', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 10 },
      result: track([interval(0, 10), interval(20, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 10, size: 100 },
      result: track([interval(0, 10), interval(20, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 0 },
      result: track([interval(0, 10), interval(10, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: -5 },
      result: track([interval(0, 10), interval(5, 10)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with place', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 0 },
      result: track([interval(0, 10), interval(10, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 0.5 },
      result: track([interval(-10, 10), interval(0, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 1 },
      result: track([interval(-20, 10), interval(-10, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 0, size: 100 },
      result: track([interval(0, 10), interval(10, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 0.5, size: 100 },
      result: track([interval(40, 10), interval(50, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 1, size: 100 },
      result: track([interval(80, 10), interval(90, 10)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with space', () => {
  test.each([
    {
      items: [{ basis: 10 }],
      options: { space: 1 },
      result: track([interval(0, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1 },
      result: track([interval(0, 10), interval(10, 10)]),
    },
    {
      items: [{ basis: 10 }],
      options: { space: 1, size: 100 },
      result: track([interval(0, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, size: 100 },
      result: track([interval(0, 10), interval(90, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, size: 100 },
      result: track([interval(0, 10), interval(50, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: -1, size: 100 },
      result: track([interval(0, 10), interval(-70, 10)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with space and spaceOuter', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { spaceOuter: 1 },
      result: track([interval(0, 10), interval(10, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 1, size: 50 },
      result: track([interval(10, 10), interval(30, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 1, size: 50 },
      result: track([interval(5, 10), interval(20, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 0.5, size: 50 },
      result: track([interval(5, 10), interval(35, 10)]),
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 0.5, size: 50 },
      result: track([interval(2.5, 10), interval(22.5, 10)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset and grow', () => {
  test.each([
    {
      items: [{ basis: 100, start: 50, grow: 1 }, { basis: 100 }],
      options: { size: 300 },
      result: track([interval(50, 150), interval(200, 100)]),
    },
    {
      items: [
        { basis: 100, end: 50 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 300 },
      result: track([interval(0, 100), interval(150, 150)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset and shrink', () => {
  test.each([
    {
      items: [{ basis: 100, start: 50, shrink: 1 }, { basis: 100 }],
      options: { size: 200 },
      result: track([interval(50, 50), interval(100, 100)]),
    },
    {
      items: [
        { basis: 100, end: 50 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 200 },
      result: track([interval(0, 100), interval(150, 50)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset and gap', () => {
  test.each([
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { gap: 50 },
      result: track([interval(50, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: { gap: 50 },
      result: track([interval(0, 100), interval(200, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset and place', () => {
  test.each([
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { place: 0, size: 300 },
      result: track([interval(50, 100), interval(150, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: { place: 0, size: 300 },
      result: track([interval(0, 100), interval(150, 100)]),
    },
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { place: 1, size: 300 },
      result: track([interval(100, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: { place: 1, size: 300 },
      result: track([interval(50, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { place: 0.5, size: 300 },
      result: track([interval(75, 100), interval(175, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset and space', () => {
  test.each([
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { space: 1, size: 300 },
      result: track([interval(50, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: { space: 1, size: 300 },
      result: track([interval(0, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 100, start: 50 }, { basis: 100 }],
      options: { space: 0.5, size: 300 },
      result: track([interval(50, 100), interval(175, 100)]),
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: { space: 0.5, size: 300 },
      result: track([interval(0, 100), interval(175, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with fixed offset, space, and spaceOuter', () => {
  test.each([
    {
      items: [{ basis: 5, start: 5 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 1, size: 50 },
      result: track([interval(15, 5), interval(30, 10)]),
    },
    {
      items: [{ basis: 5, end: 5 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 1, size: 50 },
      result: track([interval(10, 5), interval(30, 10)]),
    },
    {
      items: [{ basis: 5, start: 5 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 0.5, size: 50 },
      result: track([interval(10, 5), interval(35, 10)]),
    },
    {
      items: [{ basis: 5, end: 5 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 0.5, size: 50 },
      result: track([interval(5, 5), interval(35, 10)]),
    },
    {
      items: [{ basis: 5, start: 5 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 1, size: 50 },
      result: track([interval(10, 5), interval(20, 10)]),
    },
    {
      items: [{ basis: 5, end: 5 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 1, size: 50 },
      result: track([interval(5, 5), interval(20, 10)]),
    },
    {
      items: [{ basis: 5, start: 5 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 0.5, size: 50 },
      result: track([interval(7.5, 5), interval(22.5, 10)]),
    },
    {
      items: [{ basis: 5, end: 5 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 0.5, size: 50 },
      result: track([interval(2.5, 5), interval(22.5, 10)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow and gap', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1 }, { basis: 100 }],
      options: { gap: 50, size: 300 },
      result: track([interval(0, 150), interval(200, 100)]),
    },
    {
      items: [
        { basis: 100, grow: 1 },
        { basis: 100, grow: 1 },
      ],
      options: { gap: 50, size: 300 },
      result: track([interval(0, 125), interval(175, 125)]),
    },
    {
      items: [{ basis: 100, grow: 1 }, { basis: 100 }],
      options: { gap: -50, size: 300 },
      result: track([interval(0, 250), interval(200, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with shrink and gap', () => {
  test.each([
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 100 }],
      options: { gap: 50, size: 200 },
      result: track([interval(0, 50), interval(100, 100)]),
    },
    {
      items: [
        { basis: 100, shrink: 1 },
        { basis: 100, shrink: 1 },
      ],
      options: { gap: 50, size: 200 },
      result: track([interval(0, 75), interval(125, 75)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow, max, and place', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { place: 0, size: 300 },
      result: track([interval(0, 150), interval(150, 100)]),
    },
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { place: 0.5, size: 300 },
      result: track([interval(25, 150), interval(175, 100)]),
    },
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { place: 1, size: 300 },
      result: track([interval(50, 150), interval(200, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with shrink, min, and place', () => {
  test.each([
    {
      items: [{ basis: 100, shrink: 1, min: 50 }, { basis: 100 }],
      options: { place: 0, size: 100 },
      result: track([interval(0, 50), interval(50, 100)]),
    },
    {
      items: [{ basis: 100, shrink: 1, min: 50 }, { basis: 100 }],
      options: { place: 0.5, size: 100 },
      result: track([interval(-25, 50), interval(25, 100)]),
    },
    {
      items: [{ basis: 100, shrink: 1, min: 50 }, { basis: 100 }],
      options: { place: 1, size: 100 },
      result: track([interval(-50, 50), interval(0, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow, max, and space', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { space: 1, size: 300 },
      result: track([interval(0, 150), interval(200, 100)]),
    },
    {
      items: [
        { basis: 100, grow: 1, max: 125 },
        { basis: 100, grow: 1, max: 125 },
      ],
      options: { space: 1, size: 300 },
      result: track([interval(0, 125), interval(175, 125)]),
    },
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { space: 0.5, size: 300 },
      result: track([interval(0, 150), interval(175, 100)]),
    },
    {
      items: [{ basis: 100, grow: 1, max: 150 }, { basis: 100 }],
      options: { space: -1, size: 300 },
      result: track([interval(0, 150), interval(100, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('with grow, max, space, and spaceOuter', () => {
  test.each([
    {
      items: [{ basis: 50, grow: 1, max: 100 }, { basis: 100 }],
      options: { space: 1, spaceOuter: 1, size: 500 },
      result: track([interval(100, 100), interval(300, 100)]),
    },
    {
      items: [{ basis: 50, grow: 1, max: 100 }, { basis: 100 }],
      options: { space: 1, spaceOuter: 0.5, size: 500 },
      result: track([interval(50, 100), interval(350, 100)]),
    },
    {
      items: [{ basis: 50, grow: 1, max: 100 }, { basis: 100 }],
      options: { space: 0.5, spaceOuter: 1, size: 500 },
      result: track([interval(50, 100), interval(200, 100)]),
    },
    {
      items: [{ basis: 50, grow: 1, max: 100 }, { basis: 100 }],
      options: { space: 0.5, spaceOuter: 0.5, size: 500 },
      result: track([interval(25, 100), interval(225, 100)]),
    },
  ])('sequence($items, $options): $result', ({ items, options, result }) => {
    const track = sequence(items, options)
    expect(track).toEqual(result)
  })
})

describe('dual forms', () => {
  test('data-last form', () => {
    const operation = sequence({ size: 400 })
    expect(operation([{ basis: 100, grow: 1 }, { basis: 200 }])).toEqual(
      track([interval(0, 200), interval(200, 200)]),
    )
  })
})

describe('float-dust termination (regression)', () => {
  // Distribution rounds leave remainders manufactured by cancellation; the
  // loop treats anything below RELATIVE_TOLERANCE of the initial free space
  // as consumed instead of distributing subatomic sizes (see PRECISION.md).
  test('growing by non-dyadic factors terminates with sizes summing to the available space', () => {
    const result = sequence(
      [
        { basis: 0, grow: 0.1 },
        { basis: 0, grow: 0.2 },
        { basis: 0, grow: 0.3 },
      ],
      { size: 100 },
    )
    const total = result.intervals.reduce((sum, ival) => sum + ival.size, 0)
    expect(total).toBeCloseTo(100, 9)
  })

  test('shrinking by non-dyadic shares terminates with sizes summing to the available space', () => {
    const result = sequence(
      [
        { basis: 100, shrink: 1 },
        { basis: 200, shrink: 1 },
      ],
      { size: 200 },
    )
    const total = result.intervals.reduce((sum, ival) => sum + ival.size, 0)
    expect(total).toBeCloseTo(200, 9)
  })
})

describe('auto offsets (regression)', () => {
  // Auto (non-finite) start/end offsets absorb the free space; the walkers
  // must use definiteStart/definiteEnd or the Infinity sentinel leaks into
  // interval positions.
  test('an auto start offset pushes the item to the end', () => {
    const result = sequence([{ basis: 100, start: Number.POSITIVE_INFINITY }], { size: 500 })
    expect(result.intervals).toEqual([interval(400, 100)])
  })

  test('auto offsets on both sides center the item', () => {
    const result = sequence(
      [{ basis: 100, start: Number.POSITIVE_INFINITY, end: Number.POSITIVE_INFINITY }],
      { size: 500 },
    )
    expect(result.intervals).toEqual([interval(200, 100)])
  })

  test('auto offsets split the free space between items', () => {
    const result = sequence(
      [
        { basis: 100, end: Number.POSITIVE_INFINITY },
        { basis: 100, start: Number.POSITIVE_INFINITY },
      ],
      { size: 500 },
    )
    expect(result.intervals).toEqual([interval(0, 100), interval(400, 100)])
  })

  test('auto offsets without a definite size resolve to zero', () => {
    const result = sequence([{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 100 }], {})
    expect(result.intervals).toEqual([interval(0, 100), interval(100, 100)])
  })
})

describe('auto offsets win over place (regression)', () => {
  test('place has no free space left to position once auto offsets absorb it', () => {
    const result = sequence([{ basis: 100, start: Number.POSITIVE_INFINITY }], {
      size: 500,
      place: 1,
    })
    expect(result.intervals).toEqual([interval(400, 100)])
  })

  test('overflowing items resolve auto offsets to zero instead of negative', () => {
    const result = sequence([{ basis: 600, start: Number.POSITIVE_INFINITY }], { size: 500 })
    expect(result.intervals).toEqual([interval(0, 600)])
  })
})

describe('fractional ratios report scaled consumption (regression)', () => {
  // applyGrow/applyShrink scale each item's adjustment by the ratio but
  // used to report the unscaled distribution as consumed, so place and
  // space saw less free space than actually remained.
  test('growRatio 0.5 leaves the ungrown half of the free space for place', () => {
    const result = sequence([{ basis: 0, grow: 1 }], { size: 100, growRatio: 0.5, place: 1 })
    expect(result.intervals).toEqual([interval(50, 50)])
  })

  test('shrinkRatio 0.5 keeps the unshrunk half counting as used space for place', () => {
    const result = sequence([{ basis: 100, shrink: 1 }], { size: 50, shrinkRatio: 0.5, place: 1 })
    expect(result.intervals).toEqual([interval(-25, 75)])
  })
})
