import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('grow', () => {
  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 0,
      }),
    )

    expect(child1.rect.width).toBe(90)
    expect(child2.rect.width).toBe(10)
  })

  test('2, 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: '110px',
      height: '110px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 2,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 1,
      }),
    )

    expect(child1.rect.width).toBe(70)
    expect(child2.rect.width).toBe(40)
  })

  test('with maxWidth', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        maxWidth: '50px',
        grow: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 0,
      }),
    )

    expect(child1.rect.width).toBe(50)
    expect(child2.rect.width).toBe(10)
  })

  test('one with maxWidth one without', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        maxWidth: '40px',
        grow: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '10px',
        height: '10px',
        grow: 1,
      }),
    )

    expect(child1.rect.width).toBe(40)
    expect(child2.rect.width).toBe(60)
  })
})

describe('shrink', () => {
  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        shrink: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect.width).toBe(50)
    expect(child2.rect.width).toBe(50)
  })

  test('2, 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        shrink: 2,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        shrink: 1,
      }),
    )

    expect(child1.rect.width).toBe(33.3333)
    expect(child2.rect.width).toBe(66.6667)
  })

  test('with minWidth', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        minWidth: '90px',
        shrink: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
        shrink: 1,
      }),
    )

    expect(child1.rect.width).toBe(90)
    expect(child2.rect.width).toBe(10)
  })

  test('one with minWidth, one without', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        minWidth: '60px',
        shrink: 1,
      }),
    )

    const child2 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '100px',
        height: '10px',
        shrink: 1,
      }),
    )

    expect(child1.rect.width).toBe(60)
    expect(child2.rect.width).toBe(40)
  })
})
