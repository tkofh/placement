import { describe, expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

describe('placing', () => {
  test('children place themselves by absolute offset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetTop: '10px',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.y).toBe(10)
  })

  test('children place themselves by absolute offset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetBottom: '10px',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.y).toBe(90)
  })

  test('children place themselves by absolute offset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetLeft: '10px',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.x).toBe(10)
  })

  test('children place themselves by absolute offset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetRight: '10px',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.x).toBe(90)
  })

  test('children place themselves by relative offset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetTop: '10%',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.y).toBe(10)

    parent.height = '200px'

    expect(child.rect.y).toBe(20)
  })

  test('children place themselves by relative offset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetBottom: '10%',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.y).toBe(90)

    parent.height = '200px'

    expect(child.rect.y).toBe(180)
  })

  test('children place themselves by relative offset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetLeft: '10%',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.x).toBe(10)

    parent.width = '200px'

    expect(child.rect.x).toBe(20)
  })

  test('children place themselves by relative offset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetRight: '10%',
        width: '0px',
        height: '0px',
      }),
    )

    expect(child.rect.x).toBe(90)

    parent.width = '200px'

    expect(child.rect.x).toBe(180)
  })
})

describe('sizing', () => {
  test('children size themselves by absolute offset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetTop: '10px',
        height: 'auto',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children size themselves by absolute offset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetBottom: '10px',
        height: 'auto',
      }),
    )

    expect(child.rect.height).toBe(90)
  })

  test('children size themselves by absolute offset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetLeft: '10px',
        width: 'auto',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children size themselves by absolute offset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetRight: '10px',
        width: 'auto',
      }),
    )

    expect(child.rect.width).toBe(90)
  })

  test('children size themselves by relative offset top', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetTop: '10%',
        height: 'auto',
      }),
    )

    expect(child.rect.height).toBe(90)

    parent.height = '200px'

    expect(child.rect.height).toBe(180)
  })

  test('children size themselves by relative offset bottom', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetBottom: '10%',
        height: 'auto',
      }),
    )

    expect(child.rect.height).toBe(90)

    parent.height = '200px'

    expect(child.rect.height).toBe(180)
  })

  test('children size themselves by relative offset left', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetLeft: '10%',
        width: 'auto',
      }),
    )

    expect(child.rect.width).toBe(90)

    parent.width = '200px'

    expect(child.rect.width).toBe(180)
  })

  test('children size themselves by relative offset right', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        offsetRight: '10%',
        width: 'auto',
      }),
    )

    expect(child.rect.width).toBe(90)

    parent.width = '200px'

    expect(child.rect.width).toBe(180)
  })
})
