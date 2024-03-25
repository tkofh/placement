import { describe, expect, test } from 'vitest'
import { crossAxis, mainAxis } from '../src/core/flexbox'

describe('main axis', () => {
  test('justify start, no space', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 0,
        justify: 0,
        space: 0,
        spaceOuter: 0,
      },
      [10, 20, 30],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 10, size: 20 },
      { offset: 30, size: 30 },
    ])
  })

  test('justify start, with space', () => {
    const result = mainAxis(
      {
        size: 70,
        gap: 0,
        padding: 0,
        justify: 0,
        space: 1,
        spaceOuter: 1,
      },
      [10, 10, 10],
    )

    expect(result).toEqual([
      { offset: 10, size: 10 },
      { offset: 30, size: 10 },
      { offset: 50, size: 10 },
    ])
  })

  test('justify start, with inner space only', () => {
    const result = mainAxis(
      {
        size: 70,
        gap: 0,
        padding: 0,
        justify: 0,
        space: 1,
        spaceOuter: 0,
      },
      [10, 10, 10],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 30, size: 10 },
      { offset: 60, size: 10 },
    ])
  })

  test('justify center, no space', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 0,
        justify: 0.5,
        space: 0,
        spaceOuter: 0,
      },
      [10, 10, 10, 10],
    )

    expect(result).toEqual([
      { offset: 30, size: 10 },
      { offset: 40, size: 10 },
      { offset: 50, size: 10 },
      { offset: 60, size: 10 },
    ])
  })

  test('justify end, no space', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 0,
        justify: 1,
        space: 0,
        spaceOuter: 0,
      },
      [10, 10],
    )

    expect(result).toEqual([
      { offset: 80, size: 10 },
      { offset: 90, size: 10 },
    ])
  })

  test('one auto item', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 0,
        justify: 0,
        space: 0,
        spaceOuter: 0,
      },
      [10, 'auto', 10],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 10, size: 80 },
      { offset: 90, size: 10 },
    ])
  })

  test('two auto items', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 0,
        justify: 0,
        space: 0,
        spaceOuter: 0,
      },
      ['auto', 10, 'auto'],
    )
    expect(result).toEqual([
      { offset: 0, size: 45 },
      { offset: 45, size: 10 },
      { offset: 55, size: 45 },
    ])
  })

  test('padding', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 0,
        padding: 10,
        justify: 0,
        space: 0,
        spaceOuter: 0,
      },
      [10, 10, 10],
    )

    expect(result).toEqual([
      { offset: 10, size: 10 },
      { offset: 20, size: 10 },
      { offset: 30, size: 10 },
    ])
  })

  test('gap', () => {
    const result = mainAxis(
      {
        size: 100,
        gap: 10,
        padding: 0,
        justify: 0,
        space: 0,
        spaceOuter: 0,
      },
      [10, 10, 10],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 20, size: 10 },
      { offset: 40, size: 10 },
    ])
  })
})

describe('cross axis', () => {
  test('align start', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 0,
        stretch: 0,
      },
      [10, 20],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 0, size: 20 },
    ])
  })

  test('align center', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 0.5,
        stretch: 0,
      },
      [10, 20],
    )

    expect(result).toEqual([
      { offset: 45, size: 10 },
      { offset: 40, size: 20 },
    ])
  })

  test('align end', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 1,
        stretch: 0,
      },
      [10, 20],
    )

    expect(result).toEqual([
      { offset: 90, size: 10 },
      { offset: 80, size: 20 },
    ])
  })

  test('stretch', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 0,
        stretch: 1,
      },
      [10, 20],
    )

    expect(result).toEqual([
      { offset: 0, size: 100 },
      { offset: 0, size: 100 },
    ])
  })

  test('padding', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 10,
        align: 0,
        stretch: 0,
      },
      [10, 20],
    )

    expect(result).toEqual([
      { offset: 10, size: 10 },
      { offset: 10, size: 20 },
    ])
  })

  test('auto item', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 0,
        stretch: 0,
      },
      [10, 'auto'],
    )

    expect(result).toEqual([
      { offset: 0, size: 10 },
      { offset: 0, size: 100 },
    ])
  })

  test('auto with padding', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 10,
        align: 0,
        stretch: 0,
      },
      [10, 'auto'],
    )

    expect(result).toEqual([
      { offset: 10, size: 10 },
      { offset: 10, size: 80 },
    ])
  })

  test('align and partial stretch', () => {
    const result = crossAxis(
      {
        size: 100,
        padding: 0,
        align: 0.5,
        stretch: 0.5,
      },
      [20, 40],
    )

    expect(result).toEqual([
      { offset: 20, size: 60 },
      { offset: 15, size: 70 },
    ])
  })
})
