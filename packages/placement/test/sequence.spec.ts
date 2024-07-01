import { describe, expect, test } from 'vitest'
import { interval } from '../src/interval'
import { sequence } from '../src/track'

describe('with auto sizing', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: {},
      intervals: [interval(0, 100), interval(100, 100)],
      size: 200,
    },
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: { size: Number.POSITIVE_INFINITY },
      intervals: [interval(0, 100), interval(100, 100)],
      size: 200,
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: {},
      intervals: [interval(0, 0), interval(0, 0)],
      size: 0,
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

describe('with fixed sizing', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100 }],
      options: { size: 300 },
      intervals: [interval(0, 100), interval(100, 100)],
      size: 300,
    },
    {
      items: [{ basis: 0 }, { basis: 0 }],
      options: { size: 100 },
      intervals: [interval(0, 0), interval(0, 0)],
      size: 100,
    },
    {
      items: [{ basis: 100 }, { basis: 200 }],
      options: { size: 200 },
      intervals: [interval(0, 100), interval(100, 200)],
      size: 200,
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

describe('with fixed offset', () => {
  test.each([
    {
      items: [{ basis: 100 }, { basis: 100, start: 50 }],
      options: {},
      intervals: [interval(0, 100), interval(150, 100)],
      size: 250,
    },
    {
      items: [{ basis: 100, end: 50 }, { basis: 100 }],
      options: {},
      intervals: [interval(0, 100), interval(150, 100)],
      size: 250,
    },
    {
      items: [
        { basis: 100, end: 50 },
        { basis: 100, start: 50 },
      ],
      options: {},
      intervals: [interval(0, 100), interval(200, 100)],
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

describe('with shrink', () => {
  test.each([
    {
      items: [{ basis: 100, shrink: 1 }, { basis: 200 }],
      options: { size: 200 },
      intervals: [interval(0, 0), interval(0, 200)],
      size: 200,
    },
    {
      items: [
        { basis: 100, shrink: 1 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      intervals: [interval(0, 50), interval(50, 50)],
      size: 100,
    },
    {
      items: [
        { basis: 100, shrink: 1 },
        { basis: 200, shrink: 1 },
      ],
      options: { size: 200 },
      intervals: [
        interval(0, (100 / 3) * 2),
        interval((100 / 3) * 2, 100 + 100 / 3),
      ],
      size: 200,
    },
    {
      items: [
        { basis: 100, shrink: 2 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      intervals: [interval(0, 100 / 3), interval(100 / 3, (100 / 3) * 2)],
      size: 100,
    },
    {
      items: [
        { basis: 100, shrink: 1, min: 75 },
        { basis: 100, shrink: 1 },
      ],
      options: { size: 100 },
      intervals: [interval(0, 75), interval(75, 25)],
      size: 100,
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

describe('with gap', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 10 },
      intervals: [interval(0, 10), interval(20, 10)],
      size: 30,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 10, size: 100 },
      intervals: [interval(0, 10), interval(20, 10)],
      size: 100,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: 0 },
      intervals: [interval(0, 10), interval(10, 10)],
      size: 20,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { gap: -5 },
      intervals: [interval(0, 10), interval(5, 10)],
      size: 15,
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

describe('with place', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 1 },
      intervals: [interval(0, 10), interval(10, 10)],
      size: 20,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 1, size: 100 },
      intervals: [interval(80, 10), interval(90, 10)],
      size: 100,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { place: 0.5, size: 100 },
      intervals: [interval(40, 10), interval(50, 10)],
      size: 100,
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

describe('with space', () => {
  test.each([
    {
      items: [{ basis: 10 }],
      options: { space: 1 },
      intervals: [interval(0, 10)],
      size: 10,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1 },
      intervals: [interval(0, 10), interval(10, 10)],
      size: 20,
    },
    {
      items: [{ basis: 10 }],
      options: { space: 1, size: 100 },
      intervals: [interval(0, 10)],
      size: 100,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, size: 100 },
      intervals: [interval(0, 10), interval(90, 10)],
      size: 100,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, size: 100 },
      intervals: [interval(0, 10), interval(50, 10)],
      size: 100,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: -1, size: 100 },
      intervals: [interval(0, 10), interval(-70, 10)],
      size: 100,
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

describe('with spaceOuter', () => {
  test.each([
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { spaceOuter: 1 },
      intervals: [interval(0, 10), interval(10, 10)],
      size: 20,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 1, size: 50 },
      intervals: [interval(10, 10), interval(30, 10)],
      size: 50,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 1, size: 50 },
      intervals: [interval(5, 10), interval(20, 10)],
      size: 50,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 1, spaceOuter: 0.5, size: 50 },
      intervals: [interval(5, 10), interval(35, 10)],
      size: 50,
    },
    {
      items: [{ basis: 10 }, { basis: 10 }],
      options: { space: 0.5, spaceOuter: 0.5, size: 50 },
      intervals: [interval(2.5, 10), interval(22.5, 10)],
      size: 50,
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
