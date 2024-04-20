import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('placing', () => {
  test('children are placed by absolute inset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetTop: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(0)
    expect(child.rect.y).toBe(10)
  })

  test('children are placed by absolute inset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetLeft: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(10)
    expect(child.rect.y).toBe(0)
  })

  test('children are placed by absolute inset', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      inset: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(10)
    expect(child.rect.y).toBe(10)
  })

  test('children are placed by relative inset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetTop: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(0)
    expect(child.rect.y).toBe(10)
  })

  test('children are placed by relative inset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetLeft: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(10)
    expect(child.rect.y).toBe(0)
  })

  test('children are placed by relative inset', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      inset: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
      }),
    )

    expect(child.rect.x).toBe(10)
    expect(child.rect.y).toBe(10)
  })
})

describe('sizing', () => {
  test('children are sized by absolute inset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetTop: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '100%',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children are sized by absolute inset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetLeft: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children are sized by absolute inset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetRight: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children are sized by absolute inset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetBottom: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '100%',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children are sized by absolute inset', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      inset: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
        height: '100%',
      }),
    )

    expect(child.rect.width).toBe(80)
    expect(child.rect.height).toBe(80)
  })

  test('children are sized by relative inset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetTop: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '100%',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children are sized by relative inset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetLeft: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children are sized by relative inset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetRight: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children are sized by relative inset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      insetBottom: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '100%',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children are sized by relative inset', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      inset: '10%',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
        height: '100%',
      }),
    )

    expect(child.rect.width).toBe(80)
    expect(child.rect.height).toBe(80)
  })

  test('child size updates when inset changes', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
      inset: '10px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
        height: '100%',
      }),
    )

    expect(child.rect.width).toBe(80)
    expect(child.rect.height).toBe(80)

    parent.inset = '20px'

    expect(child.rect.width).toBe(60)
    expect(child.rect.height).toBe(60)
  })
})
