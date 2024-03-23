import { describe, expect, test } from 'vitest'
import { Box } from '../src/core/Box'

describe('boxes', () => {
  test('boxes should be sized by a width and a height', () => {
    const box = new Box({
      width: 100,
      height: 100,
    })

    expect(box.width.pixels).toBe(100)
    expect(box.height.pixels).toBe(100)
  })

  test('boxes should have mutable padding properties', () => {
    const box = new Box(100, 100)
    expect(box.padding.top).toBe(0)
    expect(box.padding.right).toBe(0)
    expect(box.padding.bottom).toBe(0)
    expect(box.padding.left).toBe(0)

    box.padding.set(10)
    expect(box.padding.top).toBe(10)
    expect(box.padding.right).toBe(10)
    expect(box.padding.bottom).toBe(10)
    expect(box.padding.left).toBe(10)
  })

  test('boxes should not allow negative padding', () => {
    const box = new Box(100, 100)
    box.padding.set(-10)
    expect(box.padding.top).toBe(0)
    expect(box.padding.right).toBe(0)
    expect(box.padding.bottom).toBe(0)
    expect(box.padding.left).toBe(0)
  })

  test('boxes should have mutable margin properties', () => {
    const box = new Box(100, 100)
    expect(box.margin.top).toBe(0)
    expect(box.margin.right).toBe(0)
    expect(box.margin.bottom).toBe(0)
    expect(box.margin.left).toBe(0)

    box.margin.set(10)
    expect(box.margin.top).toBe(10)
    expect(box.margin.right).toBe(10)
    expect(box.margin.bottom).toBe(10)
    expect(box.margin.left).toBe(10)
  })

  test('boxes should allow negative margin', () => {
    const box = new Box(100, 100)
    box.margin.set(-10)
    expect(box.margin.top).toBe(-10)
    expect(box.margin.right).toBe(-10)
    expect(box.margin.bottom).toBe(-10)
    expect(box.margin.left).toBe(-10)
  })
})
