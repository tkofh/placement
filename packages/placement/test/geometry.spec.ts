import { describe, expect, test } from 'vitest'
import { Frame } from '../src/core/Frame'

describe('frame', () => {
  test('should have mutable top, right, bottom, and left properties', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    expect(frame.top).toBe(0)
    expect(frame.right).toBe(0)
    expect(frame.bottom).toBe(0)
    expect(frame.left).toBe(0)

    frame.top = 10
    frame.right = 20
    frame.bottom = 30
    frame.left = 40

    expect(frame.top).toBe(10)
    expect(frame.right).toBe(20)
    expect(frame.bottom).toBe(30)
    expect(frame.left).toBe(40)
  })

  test('should not allow negative top, right, bottom, and left values when told to do so', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    frame.top = -10
    frame.right = -20
    frame.bottom = -30
    frame.left = -40

    expect(frame.top).toBe(0)
    expect(frame.right).toBe(0)
    expect(frame.bottom).toBe(0)
    expect(frame.left).toBe(0)
  })

  test('should allow negative top, right, bottom, and left values when told to do so', () => {
    const frame = new Frame(0, 0, 0, 0, true)
    frame.top = -10
    frame.right = -20
    frame.bottom = -30
    frame.left = -40

    expect(frame.top).toBe(-10)
    expect(frame.right).toBe(-20)
    expect(frame.bottom).toBe(-30)
    expect(frame.left).toBe(-40)
  })

  test('should be able to set all properties at once', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    frame.set(10)

    expect(frame.top).toBe(10)
    expect(frame.right).toBe(10)
    expect(frame.bottom).toBe(10)
    expect(frame.left).toBe(10)
  })

  test('should be able to set all properties at once with an object', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    frame.set({ top: 10, right: 20, bottom: 30, left: 40 })

    expect(frame.top).toBe(10)
    expect(frame.right).toBe(20)
    expect(frame.bottom).toBe(30)
    expect(frame.left).toBe(40)
  })

  test('should be able to set all properties at once with an object with x and y', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    frame.set({ x: 10, y: 20 })

    expect(frame.top).toBe(20)
    expect(frame.right).toBe(10)
    expect(frame.bottom).toBe(20)
    expect(frame.left).toBe(10)
  })

  test('should only set properties included in the set() argument', () => {
    const frame = new Frame(0, 0, 0, 0, false)
    frame.set({ x: 10 })

    expect(frame.top).toBe(0)
    expect(frame.right).toBe(10)
    expect(frame.bottom).toBe(0)
    expect(frame.left).toBe(10)

    frame.set({ y: 20 })
    expect(frame.top).toBe(20)
    expect(frame.right).toBe(10)
    expect(frame.bottom).toBe(20)
    expect(frame.left).toBe(10)

    frame.set({ top: 30 })
    expect(frame.top).toBe(30)
    expect(frame.right).toBe(10)
    expect(frame.bottom).toBe(20)
    expect(frame.left).toBe(10)
  })
})
