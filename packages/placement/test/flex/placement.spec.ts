import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('justify content', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContent: 0,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 10, y: 0 })
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContent: 0.5,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 40, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContent: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 80, y: 0 })
    expect(child2.rect).toMatchObject({ x: 90, y: 0 })
  })
})

describe('align items', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      alignItems: 0,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 0, y: 10 })
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      alignItems: 0.5,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 45, y: 0 })
    expect(child2.rect).toMatchObject({ x: 45, y: 10 })
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      alignItems: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 90, y: 0 })
    expect(child2.rect).toMatchObject({ x: 90, y: 10 })
  })
})

describe('align content', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      flexWrap: 'wrap',
      alignContent: 0,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 0, y: 50 })
    expect(child3.rect).toMatchObject({ x: 25, y: 0 })
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      flexWrap: 'wrap',
      alignContent: 0.5,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 25, y: 0 })
    expect(child2.rect).toMatchObject({ x: 25, y: 50 })
    expect(child3.rect).toMatchObject({ x: 50, y: 0 })
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      flexWrap: 'wrap',
      alignContent: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '25px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 50, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 50 })
    expect(child3.rect).toMatchObject({ x: 75, y: 0 })
  })
})

describe('align self', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      alignItems: 1,
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child.rect.y).toBe(90)

    child.alignSelf = 0

    expect(child.rect.y).toBe(0)
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      alignItems: 1,
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child.rect.y).toBe(90)

    child.alignSelf = 0.5

    expect(child.rect.y).toBe(45)
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      alignItems: 0,
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
      }),
    )

    expect(child.rect.y).toBe(0)

    child.alignSelf = 1

    expect(child.rect.y).toBe(90)
  })
})
