import { describe, expect, test } from 'vitest'
import * as Alignment from '../src/alignment.ts'
import { fields, fields2d } from '../src/internal/alignment.ts'

describe('resolve', () => {
  test.each([
    ['set fields win', { align: 1, stretch: 0.25 }, { align: 0.5, stretch: 1 }, [1, 0.25]],
    ['omitted fields inherit', {}, { align: 0.5, stretch: 1 }, [0.5, 1]],
    [
      'non-finite fields inherit',
      { align: Number.NaN, stretch: Alignment.inherit },
      { align: 0.5, stretch: 1 },
      [0.5, 1],
    ],
    ['an inherited default resolves to 0', {}, { align: Alignment.inherit }, [0, 0]],
  ] as const)('%s', (_, item, defaults, [align, stretch]) => {
    expect(Alignment.resolve(item, defaults)).toEqual({ align, stretch })
  })
})

describe('two-axis alignment', () => {
  const input = { alignX: 1, alignY: 0.5, stretchX: 0.25 }

  test('x and y read the one-axis fields of each axis', () => {
    expect(Alignment.x(input)).toEqual({ align: 1, stretch: 0.25 })
    expect(Alignment.y(input)).toEqual({ align: 0.5, stretch: undefined })
  })

  test('both flavors share one resolve per axis', () => {
    const defaults = { align: 0, stretch: 1 }
    expect(Alignment.resolve(Alignment.y(input), defaults)).toEqual(
      Alignment.resolve({ align: 0.5 }, defaults),
    )
  })
})

describe('fields', () => {
  test('every alignment field is a plain number', () => {
    expect(fields).toEqual({ align: 'number', stretch: 'number' })
    expect(fields2d).toEqual({
      alignX: 'number',
      alignY: 'number',
      stretchX: 'number',
      stretchY: 'number',
    })
  })
})
