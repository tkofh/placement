import { describe, expect, test } from 'vitest'
import { Frame } from '../src/Frame'

describe('frame', () => {
  test('it resizes', () => {
    expect(true).toBe(true)
    const outer = new Frame({ width: 200, height: 200 })
    const inner = outer.appendChild(new Frame({ width: 100, height: 100 }))

    inner.width = (parent) => parent.width
    inner.height = (parent) => parent.height

    expect(inner.computed.width).toBe(200)
    expect(inner.computed.height).toBe(200)
  })
})
