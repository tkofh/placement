import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('stretch items', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      stretchItems: 0,
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
        height: '50px',
      }),
    )

    expect(child1.rect.height).toBe(10)
    expect(child2.rect.height).toBe(50)
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      stretchItems: 0.5,
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
        height: '50px',
      }),
    )

    expect(child1.rect.height).toBe(55)
    expect(child2.rect.height).toBe(75)
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      stretchItems: 1,
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
        height: '50px',
      }),
    )

    expect(child1.rect.height).toBe(100)
    expect(child2.rect.height).toBe(100)
  })
})

describe('stretch content', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      stretchContent: 0,
      stretchItems: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect.height).toBe(25)
    expect(child2.rect.height).toBe(25)
    expect(child3.rect.height).toBe(10)
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      stretchContent: 0.5,
      stretchItems: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect.height).toBe(41.25)
    expect(child2.rect.height).toBe(41.25)
    expect(child3.rect.height).toBe(26.25)
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      stretchContent: 1,
      stretchItems: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )
    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect.height).toBe(57.5)
    expect(child2.rect.height).toBe(57.5)
    expect(child3.rect.height).toBe(42.5)
  })
})
