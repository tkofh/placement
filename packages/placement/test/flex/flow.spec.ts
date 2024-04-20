import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('direction', () => {
  test('row', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexDirection).toBe('row')

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

  test('row-reverse', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row-reverse',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexDirection).toBe('row-reverse')

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
    expect(child2.rect).toMatchObject({ x: 80, y: 0 })
  })

  test('column', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexDirection).toBe('column')

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

  test('column-reverse', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column-reverse',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexDirection).toBe('column-reverse')

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

    expect(child1.rect).toMatchObject({ x: 0, y: 90 })
    expect(child2.rect).toMatchObject({ x: 0, y: 80 })
  })
})

describe('wrap', () => {
  test('wrap', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexWrap).toBe('wrap')

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
    expect(child3.rect).toMatchObject({ x: 0, y: 50 })
  })

  test('wrap-reverse', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap-reverse',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexWrap).toBe('wrap-reverse')

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 50 })
    expect(child2.rect).toMatchObject({ x: 50, y: 50 })
    expect(child3.rect).toMatchObject({ x: 0, y: 0 })
  })

  test('nowrap', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: '100px',
      height: '100px',
    })

    expect(parent.flexWrap).toBe('nowrap')

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '50px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
    expect(child3.rect).toMatchObject({ x: 100, y: 0 })
  })
})
