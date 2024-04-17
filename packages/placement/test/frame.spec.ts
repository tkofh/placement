import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('frame', () => {
  test('it resizes', () => {
    expect(true).toBe(true)
    const outer = createFrame({ layout: 'absolute', width: 200, height: 200 })
    const inner = outer.appendChild(
      createFrame({ layout: 'absolute', width: 100, height: 100 }),
    )

    inner.width = '100%'
    inner.height = '100%'

    // outer.update()

    expect(inner.rect.width).toBe(200)
    expect(inner.rect.height).toBe(200)
  })
})
