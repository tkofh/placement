import { describe, expect, test } from 'vitest'
import { parseDimensions } from '../src/dimensions'

describe('parseDimensions', () => {
  test('parses auto dimensions', () => {
    expect(
      parseDimensions(
        { width: 'auto', height: 'auto', aspectRatio: 'none' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 0, height: 0 })
  })

  test('parses single dimension with no aspect ratio', () => {
    expect(
      parseDimensions(
        { width: 'auto', height: 100, aspectRatio: 'none' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 0, height: 100 })
    expect(
      parseDimensions(
        { width: 100, height: 'auto', aspectRatio: 'none' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 100, height: 0 })
  })

  test('parses single dimension with aspect ratio', () => {
    expect(
      parseDimensions(
        { width: 'auto', height: 100, aspectRatio: '16/9' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: (100 * 16) / 9, height: 100 })
    expect(
      parseDimensions(
        { width: 100, height: 'auto', aspectRatio: '16/9' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 100, height: (100 * 9) / 16 })
  })

  test('parses both dimensions with no aspect ratio', () => {
    expect(
      parseDimensions(
        { width: 100, height: 100, aspectRatio: 'none' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 100, height: 100 })
  })

  test('parses both dimensions with aspect ratio', () => {
    expect(
      parseDimensions(
        { width: 100, height: 100, aspectRatio: '16/9' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 100, height: 100 })
  })

  test('parses aspect ratio as inherit', () => {
    expect(
      parseDimensions(
        { width: 100, height: 'auto', aspectRatio: 'inherit' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 100, height: 50 })
    expect(
      parseDimensions(
        { width: 'auto', height: 100, aspectRatio: 'inherit' },
        { width: 200, height: 100 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ width: 200, height: 100 })
  })
})
