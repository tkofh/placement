import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('gap', () => {
  test('row', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      gap: '10px',
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
    expect(child2.rect).toMatchObject({ x: 20, y: 0 })
  })

  test('column', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'column',
      gap: '10px',
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
    expect(child2.rect).toMatchObject({ x: 0, y: 20 })
  })
})

describe('justify content space', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 0,
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
      justifyContentSpace: 0.5,
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
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 1,
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
    expect(child2.rect).toMatchObject({ x: 90, y: 0 })
  })
})

describe('justify content space outer', () => {
  test('space = 0.5, space outer = 0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 0.5,
      justifyContentSpaceOuter: 0.5,
      width: '110px',
      height: '110px',
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

    expect(child1.rect).toMatchObject({ x: 7.5, y: 0 })
    expect(child2.rect).toMatchObject({ x: 47.5, y: 0 })
  })

  test('space = 1, space outer = 0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 1,
      justifyContentSpaceOuter: 0.5,
      width: '110px',
      height: '110px',
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

    expect(child1.rect).toMatchObject({ x: 15, y: 0 })
    expect(child2.rect).toMatchObject({ x: 85, y: 0 })
  })

  test('space = 0.5, space outer = 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 0.5,
      justifyContentSpaceOuter: 1,
      width: '110px',
      height: '110px',
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

    expect(child1.rect).toMatchObject({ x: 15, y: 0 })
    expect(child2.rect).toMatchObject({ x: 40, y: 0 })
  })

  test('space = 1, space outer = 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      justifyContentSpace: 1,
      justifyContentSpaceOuter: 1,
      width: '110px',
      height: '110px',
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

    expect(child1.rect).toMatchObject({ x: 30, y: 0 })
    expect(child2.rect).toMatchObject({ x: 70, y: 0 })
  })
})

describe('align content space', () => {
  test('0', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 0,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
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
        height: '25px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
    expect(child3.rect).toMatchObject({ x: 0, y: 25 })
  })

  test('0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 0.5,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
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
        height: '25px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
    expect(child3.rect).toMatchObject({ x: 0, y: 50 })
  })

  test('1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 1,
      width: '100px',
      height: '100px',
    })

    const child1 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '25px',
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
        height: '25px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 0 })
    expect(child2.rect).toMatchObject({ x: 50, y: 0 })
    expect(child3.rect).toMatchObject({ x: 0, y: 75 })
  })
})

describe('align content space outer', () => {
  test('space = 0.5, space outer = 0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 0.5,
      alignContentSpaceOuter: 0.5,
      width: '110px',
      height: '110px',
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
        height: '10px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 7.5 })
    expect(child2.rect).toMatchObject({ x: 50, y: 7.5 })
    expect(child3.rect).toMatchObject({ x: 0, y: 47.5 })
  })
  test('space = 0.5, space outer = 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 0.5,
      alignContentSpaceOuter: 1,
      width: '110px',
      height: '110px',
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
        height: '10px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 15 })
    expect(child2.rect).toMatchObject({ x: 50, y: 15 })
    expect(child3.rect).toMatchObject({ x: 0, y: 40 })
  })

  test('space = 1, space outer = 0.5', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 1,
      alignContentSpaceOuter: 0.5,
      width: '110px',
      height: '110px',
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
        height: '10px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 15 })
    expect(child2.rect).toMatchObject({ x: 50, y: 15 })
    expect(child3.rect).toMatchObject({ x: 0, y: 85 })
  })

  test('space = 1, space outer = 1', () => {
    const parent = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContentSpace: 1,
      alignContentSpaceOuter: 1,
      width: '110px',
      height: '110px',
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
        height: '10px',
      }),
    )
    const child3 = parent.appendChild(
      createFrame({
        layout: 'flex',
        width: '50px',
        height: '10px',
      }),
    )

    expect(child1.rect).toMatchObject({ x: 0, y: 30 })
    expect(child2.rect).toMatchObject({ x: 50, y: 30 })
    expect(child3.rect).toMatchObject({ x: 0, y: 70 })
  })
})
