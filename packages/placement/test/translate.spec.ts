import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('translate X', () => {
  test('basic case', () => {
    const root = createFrame({
      layout: 'absolute',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        translateX: 0,
      }),
    )

    expect(child.translateX).toBe(0)
    expect(child.rect.x).toBe(0)

    child.translateX = 10
    expect(child.translateX).toBe(10)
    expect(child.rect.x).toBe(10)
  })

  test('does not impact layout', () => {
    const root = createFrame({
      layout: 'flex',
      width: 100,
      height: 100,
    })

    const child1 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
      }),
    )
    const child2 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
      }),
    )

    expect(child1.rect.x).toBe(0)
    expect(child2.rect.x).toBe(50)

    child1.translateX = 50

    expect(child1.translateX).toBe(50)
    expect(child1.rect.x).toBe(50)
  })
})

describe('translate Y', () => {
  test('basic case', () => {
    const root = createFrame({
      layout: 'absolute',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        translateY: 0,
      }),
    )

    expect(child.translateY).toBe(0)
    expect(child.rect.y).toBe(0)

    child.translateY = 10
    expect(child.translateY).toBe(10)
    expect(child.rect.y).toBe(10)
  })

  test('does not impact layout', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      width: 100,
      height: 100,
    })

    const child1 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
      }),
    )
    const child2 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
      }),
    )

    expect(child1.rect.y).toBe(0)
    expect(child2.rect.y).toBe(50)

    child1.translateY = 50

    expect(child1.translateY).toBe(50)
    expect(child1.rect.y).toBe(50)
  })
})
