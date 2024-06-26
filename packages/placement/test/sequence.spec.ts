import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { sequence } from '../src/track'

describe('basic', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: {},
      intervals: [interval(0, 100), interval(100, 100)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: { size: 300 },
      intervals: [interval(0, 100), interval(100, 100)],
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
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(100, 200)],
      size: 300,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = sequence(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})

describe('with grow', () => {
  test.each([
    {
      items: [{ basis: 100, grow: 1 }, { basis: 200 }],
      options: {},
      intervals: [interval(0, 100), interval(100, 200)],
      size: 300,
    },
    {
      items: [{ basis: 100, grow: 1 }, { basis: 200 }],
      options: { size: 400 },
      intervals: [interval(0, 200), interval(200, 200)],
      size: 400,
    },
    {
      items: [
        { basis: 100, grow: 1 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      intervals: [interval(0, 200), interval(200, 200)],
      size: 400,
    },
    {
      items: [
        { basis: 100, grow: 3 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      intervals: [interval(0, 250), interval(250, 150)],
      size: 400,
    },
    {
      items: [
        { basis: 100, grow: 1 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 150 },
      intervals: [interval(0, 100), interval(100, 100)],
      size: 150,
    },
    {
      items: [
        { basis: 100, grow: 3, max: 200 },
        { basis: 100, grow: 1 },
      ],
      options: { size: 400 },
      intervals: [interval(0, 200), interval(200, 200)],
      size: 400,
    },
    {
      items: [
        { basis: 50, grow: 3, max: 100 },
        { basis: 50, grow: 3 },
        { basis: 50, grow: 1 },
      ],
      options: { size: 400 },
      intervals: [interval(0, 100), interval(100, 200), interval(300, 100)],
      size: 400,
    },
  ])(
    'stack($items, $options) -> Track($size, $intervals)',
    ({ items, options, size, intervals }) => {
      const track = sequence(items, options)
      expect(track.size).toBe(size)
      expect(track.intervals).toEqual(intervals)
    },
  )
})
