import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('insert', () => {
  test('should insert frame before another', () => {
    const root = createFrame({ layout: 'flex', width: 100, height: 100 })

    const child1 = root.appendChild(
      createFrame({ layout: 'absolute', width: 50, height: 50 }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })

    const child0 = root.insertBefore(
      createFrame({ layout: 'absolute', width: 50, height: 50 }),
      child1,
    )

    expect(child0.rect).toMatchObject({ x: 0, y: 0 })
    expect(child1.rect).toMatchObject({ x: 50, y: 0 })
  })
})

describe('remove', () => {
  test('layout should be updated after removing a child', () => {
    const root = createFrame({ layout: 'flex', width: 100, height: 100 })

    const child0 = root.appendChild(
      createFrame({ layout: 'absolute', width: 50, height: 50 }),
    )

    const child1 = root.appendChild(
      createFrame({ layout: 'absolute', width: 50, height: 50 }),
    )

    expect(child0.rect).toMatchObject({ x: 0, y: 0 })
    expect(child1.rect).toMatchObject({ x: 50, y: 0 })

    root.removeChild(child0)

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
  })
})
