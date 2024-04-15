import { describe, expect, test } from 'vitest'
import { Frame } from '../src/frame/Frame'

describe('frame', () => {
  test('it resizes', () => {
    expect(true).toBe(true)
    const outer = new Frame({ width: 200, height: 200 })
    const inner = outer.appendChild(new Frame({ width: 100, height: 100 }))

    inner.config.width = '100%'
    inner.config.height = '100%'

    outer.update()

    expect(inner.rect.width).toBe(200)
    expect(inner.rect.height).toBe(200)
  })
})
