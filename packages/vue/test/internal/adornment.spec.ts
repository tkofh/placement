import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { drawnLine } from '../../src/internal/adornment.ts'

// An L: right 100, then down 100. Its corner is 100 along, sized 8.
const ell = [Point.make(0, 0), Point.make(100, 0), Point.make(100, 100)]
const radii = [0, 8, 0]

describe('drawnLine', () => {
  test.each([
    [0, [Point.make(0, 0), Point.make(100, 0), Point.make(100, 100)], [0, 8, 0]],
    [30, [Point.make(0, 0), Point.make(100, 0), Point.make(100, 70)], [0, 8, 0]],
    [100, [Point.make(0, 0), Point.make(100, 0)], [0, 0]],
    [150, [Point.make(0, 0), Point.make(50, 0)], [0, 0]],
    [500, [Point.make(0, 0), Point.make(0, 0)], [0, 0]],
  ] as const)('pulls the end back by %i, with the corners it keeps', (end, points, rooms) => {
    expect(drawnLine(ell, radii, { start: 0, end })).toEqual({
      points,
      rooms,
      nests: rooms.map(() => 0),
    })
  })

  test('pulls both ends back', () => {
    expect(drawnLine(ell, radii, { start: 20, end: 30 })).toEqual({
      points: [Point.make(20, 0), Point.make(100, 0), Point.make(100, 70)],
      rooms: [0, 8, 0],
      nests: [0, 0, 0],
    })
  })

  test('keeps the nest outsets of the corners it keeps', () => {
    expect(drawnLine(ell, radii, { start: 0, end: 30 }, [0, 4, 0]).nests).toEqual([0, 4, 0])
    expect(drawnLine(ell, radii, { start: 0, end: 100 }, [0, 4, 0]).nests).toEqual([0, 0])
  })
})
