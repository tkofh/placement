import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { sequence, track } from '../src/track'

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
      result: track([
        interval(0, (100 / 3) * 2),
        interval((100 / 3) * 2, 100 + 100 / 3),
      ]),
    },
    {
      items: [
        { basis: 100, shrink: 2 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      result: track([interval(0, 100 / 3), interval(100 / 3, (100 / 3) * 2)]),
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
