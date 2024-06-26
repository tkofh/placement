import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { stack } from '../src/track'

/**
 * things to test:
 * - basic cases
 * - with stretch
 * - with place
 * - with stretch and place
 * - with definite offsets
 * - with auto offsets
 */

describe('basic', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { size: 300 },
      intervals: [interval(0, 100), interval(0, 200)],
      size: 300,
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: {},
      intervals: [interval(0, 0), interval(0, 0)],
      size: 0,
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: { size: 100 },
      intervals: [interval(0, 0), interval(0, 0)],
      size: 100,
    },
    {
      items: [{ basis: -100 }],
      options: {},
      intervals: [interval(0, 0)],
      size: 0,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('with stretch', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 200), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { stretch: 1 },
      intervals: [interval(0, 200), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: 0 }, { basis: 200 }],
      options: { stretch: 1 },
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 150), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: -1 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('wth place', () => {
  test.each([
    {
      items: [{ basis: 100, place: 0 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: {},
      intervals: [interval(100, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: 0.5 }, { basis: 200 }],
      options: {},
      intervals: [interval(50, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: -1 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: 2 }, { basis: 200 }],
      options: {},
      intervals: [interval(100, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 1 },
      intervals: [interval(100, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      intervals: [interval(50, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 100 }, { basis: 200 }],
      options: { place: 0.5 },
      intervals: [interval(100, 100), interval(50, 100), interval(0, 200)],
      size: 200,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('with stretch and place', () => {
  test.each([
    {
      items: [{ basis: 100, stretch: 1, place: 0 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 200), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: 1, place: 1 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 200), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: 0.5, place: 0.5 }, { basis: 200 }],
      options: {},
      intervals: [interval(25, 150), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, stretch: 0.5 }, { basis: 200 }],
      options: { place: 1 },
      intervals: [interval(50, 150), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, place: 1 }, { basis: 200 }],
      options: { stretch: 0.5 },
      intervals: [interval(50, 150), interval(0, 200)],
      size: 200,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('with definite offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: 10 }, { basis: 200 }],
      options: {},
      intervals: [interval(10, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, end: 10 }, { basis: 200 }],
      options: { place: 1 },
      intervals: [interval(90, 100), interval(0, 200)],
      size: 200,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('with auto offsets', () => {
  test.each([
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      intervals: [interval(100, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, start: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 0 },
      intervals: [interval(100, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
    },
    {
      items: [{ basis: 100, end: Number.POSITIVE_INFINITY }, { basis: 200 }],
      options: { place: 1 },
      intervals: [interval(0, 100), interval(0, 200)],
      size: 200,
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
      intervals: [interval(50, 100), interval(0, 200)],
      size: 200,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = stack(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})
