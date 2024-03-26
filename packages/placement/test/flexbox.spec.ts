import { describe, expect, test } from 'vitest'
import { flexbox } from '../src/flexbox'

describe('main axis', () => {
  test('justify start, no space', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        direction: 'row',
      },
      [
        { width: 10, height: 10 },
        { width: 20, height: 20 },
        { width: 30, height: 30 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 20, height: 20 },
      { x: 30, y: 0, width: 30, height: 30 },
    ])
  })

  test('justify start, with space', () => {
    const result = flexbox(
      { width: 70, height: 100 },
      {
        space: 1,
        spaceOuter: 1,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
    )

    expect(result).toEqual([
      { x: 10, y: 0, width: 10, height: 10 },
      { x: 30, y: 0, width: 10, height: 10 },
      { x: 50, y: 0, width: 10, height: 10 },
    ])
  })

  test('justify start, with inner space only', () => {
    const result = flexbox(
      { width: 70, height: 100 },
      {
        space: 1,
        spaceOuter: 0,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 30, y: 0, width: 10, height: 10 },
      { x: 60, y: 0, width: 10, height: 10 },
    ])
  })

  test('justify center, no space', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        justify: 0.5,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
    )

    expect(result).toEqual([
      { x: 30, y: 0, width: 10, height: 10 },
      { x: 40, y: 0, width: 10, height: 10 },
      { x: 50, y: 0, width: 10, height: 10 },
      { x: 60, y: 0, width: 10, height: 10 },
    ])
  })

  test('justify end, no space', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        justify: 1,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
    )

    expect(result).toEqual([
      { x: 60, y: 0, width: 10, height: 10 },
      { x: 70, y: 0, width: 10, height: 10 },
      { x: 80, y: 0, width: 10, height: 10 },
      { x: 90, y: 0, width: 10, height: 10 },
    ])
  })

  test('one auto item', () => {
    const result = flexbox({ width: 100, height: 100 }, {}, [
      { width: 10, height: 10 },
      { width: 'auto', height: 10 },
      { width: 10, height: 10 },
    ])

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 80, height: 10 },
      { x: 90, y: 0, width: 10, height: 10 },
    ])
  })

  test('two auto items', () => {
    const result = flexbox({ width: 100, height: 100 }, {}, [
      { width: 'auto', height: 10 },
      { width: 10, height: 10 },
      { width: 'auto', height: 10 },
    ])
    expect(result).toEqual([
      { x: 0, y: 0, width: 45, height: 10 },
      { x: 45, y: 0, width: 10, height: 10 },
      { x: 55, y: 0, width: 45, height: 10 },
    ])
  })

  test('gap', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        gap: 10,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 },
        { width: 10, height: 10 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 0, width: 10, height: 10 },
      { x: 40, y: 0, width: 10, height: 10 },
    ])
  })
})

describe('cross axis', () => {
  test('align start', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        align: 0,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 20 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 20 },
    ])
  })

  test('align center', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        align: 0.5,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 20 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 45, width: 10, height: 10 },
      { x: 10, y: 40, width: 10, height: 20 },
    ])
  })

  test('align end', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        align: 1,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 20 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 90, width: 10, height: 10 },
      { x: 10, y: 80, width: 10, height: 20 },
    ])
  })

  test('stretch', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        stretch: 1,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 20 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 100 },
      { x: 10, y: 0, width: 10, height: 100 },
    ])
  })

  test('auto item', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        align: 0,
        stretch: 0,
      },
      [
        { width: 10, height: 10 },
        { width: 10, height: 'auto' },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 100 },
    ])
  })

  test('align and partial stretch', () => {
    const result = flexbox(
      { width: 100, height: 100 },
      {
        align: 0.5,
        stretch: 0.5,
      },
      [
        { width: 10, height: 20 },
        { width: 10, height: 40 },
      ],
    )

    expect(result).toEqual([
      { x: 0, y: 20, width: 10, height: 60 },
      { x: 10, y: 15, width: 10, height: 70 },
    ])
  })
})
