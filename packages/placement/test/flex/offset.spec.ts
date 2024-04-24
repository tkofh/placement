import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame'

describe('definite', () => {
  test('should respect definite main offset start', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 10,
      }),
    )

    expect(child.rect.x).toBe(10)

    root.flexDirection = 'column'

    expect(child.rect.y).toBe(10)

    root.flexDirection = 'row-reverse'

    expect(child.rect.x).toBe(40)

    root.flexDirection = 'column-reverse'

    expect(child.rect.y).toBe(40)
  })

  test('should respect definite main offset end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
      inset: -10,
    })

    root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
        offset: 10,
      }),
    )

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
      }),
    )

    expect(child.rect.x).toBe(20)

    root.flexDirection = 'column'

    expect(child.rect.y).toBe(20)

    root.flexDirection = 'row-reverse'

    expect(child.rect.x).toBe(70)

    root.flexDirection = 'column-reverse'

    expect(child.rect.y).toBe(70)
  })

  test('should respect definite cross offset start', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 10,
      }),
    )

    expect(child.rect.y).toBe(10)

    root.flexDirection = 'column'

    expect(child.rect.x).toBe(10)

    root.flexDirection = 'row-reverse'

    expect(child.rect.y).toBe(10)

    root.flexDirection = 'column-reverse'

    expect(child.rect.x).toBe(10)
  })

  test('should respect definite cross offset end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
      alignItems: 1,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
        offset: 10,
      }),
    )

    expect(child.rect.y).toBe(80)

    root.flexDirection = 'column'

    expect(child.rect.x).toBe(80)

    root.flexDirection = 'row-reverse'

    expect(child.rect.y).toBe(80)

    root.flexDirection = 'column-reverse'

    expect(child.rect.x).toBe(80)
  })
})

describe('auto', () => {
  test('should respect auto main offset start', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 'none',
      }),
    )

    expect(child.rect.x).toBe(0)
    child.offsetLeft = 'auto'
    expect(child.rect.x).toBe(50)
    child.offsetLeft = 'none'

    root.flexDirection = 'column'

    expect(child.rect.y).toBe(0)
    child.offsetTop = 'auto'
    expect(child.rect.y).toBe(50)
    child.offsetTop = 'none'

    root.flexDirection = 'row-reverse'

    expect(child.rect.x).toBe(50)
    child.offsetRight = 'auto'
    expect(child.rect.x).toBe(0)
    child.offsetRight = 'none'

    root.flexDirection = 'column-reverse'

    expect(child.rect.y).toBe(50)
    child.offsetBottom = 'auto'
    expect(child.rect.y).toBe(0)
  })

  test('should respect auto main offset end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const offset = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
        offset: 'none',
      }),
    )

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
      }),
    )

    expect(child.rect.x).toBe(10)
    offset.offsetRight = 'auto'
    expect(child.rect.x).toBe(90)
    offset.offsetRight = 'none'

    root.flexDirection = 'column'

    expect(child.rect.y).toBe(10)
    offset.offsetBottom = 'auto'
    expect(child.rect.y).toBe(90)
    offset.offsetBottom = 'none'

    root.flexDirection = 'row-reverse'

    expect(child.rect.x).toBe(80)
    offset.offsetLeft = 'auto'
    expect(child.rect.x).toBe(0)
    offset.offsetLeft = 'none'

    root.flexDirection = 'column-reverse'

    expect(child.rect.y).toBe(80)
    offset.offsetTop = 'auto'
    expect(child.rect.y).toBe(0)
  })

  test('should respect auto main offset start and end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 'auto',
      }),
    )

    expect(child.rect.x).toBe(25)

    root.flexDirection = 'column'

    expect(child.rect.y).toBe(25)
  })

  test('should respect auto main for multiple items', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child1 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
      }),
    )
    const child2 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
      }),
    )
    const child3 = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 10,
        height: 10,
      }),
    )

    expect(child2.rect.x).toBe(10)
    expect(child3.rect.x).toBe(20)

    child1.offsetRight = 'auto'

    expect(child2.rect.x).toBe(80)
    expect(child3.rect.x).toBe(90)

    child3.offsetLeft = 'auto'

    expect(child2.rect.x).toBe(45)
  })

  test('should respect auto cross offset start', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
      alignItems: 0.5,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 'none',
      }),
    )

    expect(child.rect.y).toBe(25)
    child.offsetTop = 'auto'
    expect(child.rect.y).toBe(50)
    child.offsetTop = 'none'

    root.flexDirection = 'column'

    expect(child.rect.x).toBe(25)
    child.offsetLeft = 'auto'
    expect(child.rect.x).toBe(50)
    child.offsetLeft = 'none'
  })

  test('should respect auto cross offset end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
      alignItems: 0.5,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
      }),
    )

    expect(child.rect.y).toBe(25)
    child.offsetBottom = 'auto'
    expect(child.rect.y).toBe(0)
    child.offsetBottom = 'none'

    root.flexDirection = 'column'

    expect(child.rect.x).toBe(25)
    child.offsetRight = 'auto'
    expect(child.rect.x).toBe(0)
  })

  test('should respect auto offset start and end', () => {
    const root = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: 100,
      height: 100,
    })

    const child = root.appendChild(
      createFrame({
        layout: 'absolute',
        width: 50,
        height: 50,
        offset: 'none',
      }),
    )

    expect(child.rect.y).toBe(0)
    child.offsetY = 'auto'
    expect(child.rect.y).toBe(25)
    child.offsetY = 'none'

    root.flexDirection = 'column'

    expect(child.rect.x).toBe(0)
    child.offsetX = 'auto'
    expect(child.rect.x).toBe(25)
  })
})
