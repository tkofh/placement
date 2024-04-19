import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('width, height, aspectRatio', () => {
  test('sizes with width and height', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100px',
        height: '100px',
      }),
    )

    expect(child.width).toBe('100px')
    expect(child.height).toBe('100px')

    expect(child.rect.width).toBe(100)
    expect(child.rect.height).toBe(100)
  })

  test('sizes with width and aspectRatio', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '1600px',
      height: '900px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '1600px',
        aspectRatio: '16 / 9',
      }),
    )

    expect(child.aspectRatio).toBe('16 / 9')

    expect(child.rect.width).toBe(1600)
    expect(child.rect.height).toBe(900)
  })

  test('sizes with height and aspectRatio', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '1600px',
      height: '900px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '900px',
        aspectRatio: '16 / 9',
      }),
    )

    expect(child.aspectRatio).toBe('16 / 9')

    expect(child.rect.width).toBe(1600)
    expect(child.rect.height).toBe(900)
  })
})

describe('size constraints', () => {
  test('relative width clamped by absolute minWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '25%',
        minWidth: '50px',
      }),
    )

    expect(child.width).toBe('25%')
    expect(child.rect.width).toBe(50)

    child.width = '75%'

    expect(child.width).toBe('75%')
    expect(child.rect.width).toBe(75)

    child.width = '25%'
    parent.width = '400px'

    expect(child.width).toBe('25%')
    expect(child.rect.width).toBe(100)
  })

  test('relative width clamped by absolute maxWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '75%',
        maxWidth: '50px',
      }),
    )

    expect(child.width).toBe('75%')
    expect(child.rect.width).toBe(50)

    child.width = '25%'

    expect(child.width).toBe('25%')
    expect(child.rect.width).toBe(25)

    child.width = '75%'
    parent.width = '50px'

    expect(child.width).toBe('75%')
    expect(child.rect.width).toBe(37.5)
  })

  test('relative height clamped by absolute minHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '25%',
        minHeight: '50px',
      }),
    )

    expect(child.height).toBe('25%')
    expect(child.rect.height).toBe(50)

    child.height = '75%'

    expect(child.height).toBe('75%')
    expect(child.rect.height).toBe(75)

    child.height = '25%'
    parent.height = '400px'

    expect(child.height).toBe('25%')
    expect(child.rect.height).toBe(100)
  })

  test('relative height clamped by absolute maxHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '75%',
        maxHeight: '50px',
      }),
    )

    expect(child.height).toBe('75%')
    expect(child.rect.height).toBe(50)

    child.height = '25%'

    expect(child.height).toBe('25%')
    expect(child.rect.height).toBe(25)

    child.height = '75%'
    parent.height = '50px'

    expect(child.height).toBe('75%')
    expect(child.rect.height).toBe(37.5)
  })

  test('relative width clamped by absolute minWidth and maxWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '100%',
        minWidth: '25px',
        maxWidth: '75px',
      }),
    )

    expect(child.width).toBe('100%')
    expect(child.rect.width).toBe(75)

    child.width = '50%'

    expect(child.width).toBe('50%')
    expect(child.rect.width).toBe(50)

    child.width = '0%'

    expect(child.width).toBe('0%')
    expect(child.rect.width).toBe(25)

    child.width = '100%'
    parent.width = '0px'

    expect(child.width).toBe('100%')
    expect(child.rect.width).toBe(25)

    parent.width = '200px'

    expect(child.rect.width).toBe(75)
  })

  test('relative height clamped by absolute minHeight and maxHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '100%',
        minHeight: '25px',
        maxHeight: '75px',
      }),
    )

    expect(child.height).toBe('100%')
    expect(child.rect.height).toBe(75)

    child.height = '50%'

    expect(child.height).toBe('50%')
    expect(child.rect.height).toBe(50)

    child.height = '0%'

    expect(child.height).toBe('0%')
    expect(child.rect.height).toBe(25)

    child.height = '100%'
    parent.height = '0px'

    expect(child.height).toBe('100%')
    expect(child.rect.height).toBe(25)

    parent.height = '200px'

    expect(child.rect.height).toBe(75)
  })

  test('absolute width clamped by relative minWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '50px',
        minWidth: '75%',
      }),
    )

    expect(child.width).toBe('50px')
    expect(child.rect.width).toBe(75)

    child.width = '100px'

    expect(child.width).toBe('100px')
    expect(child.rect.width).toBe(100)
  })

  test('absolute width clamped by relative maxWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '50px',
        maxWidth: '25%',
      }),
    )

    expect(child.width).toBe('50px')
    expect(child.rect.width).toBe(25)

    child.width = '0px'

    expect(child.width).toBe('0px')
    expect(child.rect.width).toBe(0)

    child.width = '50px'
    parent.width = '0px'

    expect(child.width).toBe('50px')
    expect(child.rect.width).toBe(0)
  })

  test('absolute height clamped by relative minHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '50px',
        minHeight: '75%',
      }),
    )

    expect(child.height).toBe('50px')
    expect(child.rect.height).toBe(75)

    child.height = '100px'

    expect(child.height).toBe('100px')
    expect(child.rect.height).toBe(100)

    child.height = '50px'
    parent.height = '200px'

    expect(child.height).toBe('50px')
    expect(child.rect.height).toBe(150)
  })

  test('absolute height clamped by relative maxHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '50px',
        maxHeight: '25%',
      }),
    )

    expect(child.height).toBe('50px')
    expect(child.rect.height).toBe(25)

    child.height = '0px'

    expect(child.height).toBe('0px')
    expect(child.rect.height).toBe(0)

    child.height = '50px'
    parent.height = '0px'

    expect(child.height).toBe('50px')
    expect(child.rect.height).toBe(0)
  })

  test('absolute width clamped by relative minWidth and maxWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '0px',
        minWidth: '25%',
        maxWidth: '75%',
      }),
    )

    expect(child.width).toBe('0px')
    expect(child.rect.width).toBe(25)

    child.width = '50px'

    expect(child.width).toBe('50px')
    expect(child.rect.width).toBe(50)

    child.width = '100px'

    expect(child.width).toBe('100px')
    expect(child.rect.width).toBe(75)

    parent.width = '800px'

    expect(child.rect.width).toBe(200)

    parent.width = '100px'

    expect(child.rect.width).toBe(75)
  })

  test('absolute height clamped by relative minHeight and maxHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '0px',
        minHeight: '25%',
        maxHeight: '75%',
      }),
    )

    expect(child.height).toBe('0px')
    expect(child.rect.height).toBe(25)

    child.height = '50px'

    expect(child.height).toBe('50px')
    expect(child.rect.height).toBe(50)

    child.height = '100px'

    expect(child.height).toBe('100px')
    expect(child.rect.height).toBe(75)

    parent.height = '800px'

    expect(child.rect.height).toBe(200)

    parent.height = '100px'

    expect(child.rect.height).toBe(75)
  })

  test('minWidth takes precedence over maxWidth', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        width: '75%',
        minWidth: '50px',
        maxWidth: '25px',
      }),
    )

    expect(child.width).toBe('75%')
    expect(child.rect.width).toBe(50)
  })

  test('minHeight takes precedence over maxHeight', () => {
    const parent = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    const child = parent.appendChild(
      createFrame({
        layout: 'absolute',
        height: '75%',
        minHeight: '50px',
        maxHeight: '25px',
      }),
    )

    expect(child.height).toBe('75%')
    expect(child.rect.height).toBe(50)
  })
})
