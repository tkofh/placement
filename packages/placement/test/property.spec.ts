import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('keyword', () => {
  test('accepts valid keywords', () => {
    const frame = createFrame({
      layout: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      width: 'auto',
    })

    expect(frame.flexDirection).toBe('row')
    expect(frame.flexWrap).toBe('nowrap')
    expect(frame.width).toBe('auto')
  })

  test('throws for invalid keywords', () => {
    // @ts-expect-error - testing runtime validation of invalid keyword
    expect(() => createFrame({ layout: 'flex', width: 'hello' })).toThrow()
  })
})

describe('length', () => {
  test('accepts numbers as pixels', () => {
    const frame = createFrame({
      layout: 'flex',
      width: 100,
      height: 100,
    })

    expect(frame.width).toBe(100)
    expect(frame.height).toBe(100)

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts string numbers as pixels', () => {
    const frame = createFrame({
      layout: 'flex',
      width: '100',
      height: '100',
    })

    expect(frame.width).toBe('100')
    expect(frame.height).toBe('100')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts labeled pixels', () => {
    const frame = createFrame({
      layout: 'flex',
      width: '100px',
      height: '100px',
    })

    expect(frame.width).toBe('100px')
    expect(frame.height).toBe('100px')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts vw', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100vw', height: '100vw' }),
    )

    expect(frame.width).toBe('100vw')
    expect(frame.height).toBe('100vw')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts vh', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100vh', height: '100vh' }),
    )

    expect(frame.width).toBe('100vh')
    expect(frame.height).toBe('100vh')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts vmin', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 50 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100vmin', height: '100vmin' }),
    )

    expect(frame.width).toBe('100vmin')
    expect(frame.height).toBe('100vmin')

    expect(frame.rect.width).toBe(50)
    expect(frame.rect.height).toBe(50)
  })

  test('accepts vmax', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 50 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100vmax', height: '100vmax' }),
    )

    expect(frame.width).toBe('100vmax')
    expect(frame.height).toBe('100vmax')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('accepts cw', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100cw', height: '100cw' }),
    )

    expect(frame.width).toBe('100cw')
    expect(frame.height).toBe('100cw')

    expect(frame.rect.width).toBe(50)
    expect(frame.rect.height).toBe(50)
  })

  test('accepts ch', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100ch', height: '100ch' }),
    )

    expect(frame.width).toBe('100ch')
    expect(frame.height).toBe('100ch')

    expect(frame.rect.width).toBe(50)
    expect(frame.rect.height).toBe(50)
  })

  test('accepts cmin', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 50 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100cmin', height: '100cmin' }),
    )

    expect(frame.width).toBe('100cmin')
    expect(frame.height).toBe('100cmin')

    expect(frame.rect.width).toBe(25)
    expect(frame.rect.height).toBe(25)
  })

  test('accepts cmax', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 50 })
    const parent = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )
    const frame = parent.appendChild(
      createFrame({ layout: 'flex', width: '100cmax', height: '100cmax' }),
    )

    expect(frame.width).toBe('100cmax')
    expect(frame.height).toBe('100cmax')

    expect(frame.rect.width).toBe(50)
    expect(frame.rect.height).toBe(50)
  })

  test('throws for unknown unit', () => {
    expect(() =>
      // @ts-expect-error - testing runtime validation of invalid unit
      createFrame({ layout: 'absolute', width: '100blah' }),
    ).toThrow()
  })
})

describe('percentage', () => {
  test('accepts percentage', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const frame = root.appendChild(
      createFrame({ layout: 'absolute', width: '50%', height: '50%' }),
    )

    expect(frame.width).toBe('50%')
    expect(frame.height).toBe('50%')

    expect(frame.rect.width).toBe(50)
    expect(frame.rect.height).toBe(50)
  })

  test('accepts percentage with decimal', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const frame = root.appendChild(
      createFrame({ layout: 'absolute', width: '50.5%', height: '50.5%' }),
    )

    expect(frame.width).toBe('50.5%')
    expect(frame.height).toBe('50.5%')

    expect(frame.rect.width).toBe(50.5)
    expect(frame.rect.height).toBe(50.5)
  })

  test('accepts percentage with decimal and no leading digit', () => {
    const root = createFrame({ layout: 'absolute', width: 100, height: 100 })
    const frame = root.appendChild(
      createFrame({ layout: 'absolute', width: '.5%', height: '.5%' }),
    )

    expect(frame.width).toBe('.5%')
    expect(frame.height).toBe('.5%')

    expect(frame.rect.width).toBe(0.5)
    expect(frame.rect.height).toBe(0.5)
  })
})

describe('number', () => {
  test('accepts a number', () => {
    const frame = createFrame({
      layout: 'absolute',
      grow: 1,
    })

    expect(frame.grow).toBe(1)
  })

  test('accepts a string number', () => {
    const frame = createFrame({
      layout: 'absolute',
      grow: '1',
    })

    expect(frame.grow).toBe('1')
  })

  test('throws for invalid number', () => {
    // @ts-expect-error - testing runtime validation of invalid number
    expect(() => createFrame({ layout: 'absolute', grow: 'hello' })).toThrow()
  })
})

describe('ratio', () => {
  test('accepts number', () => {
    const frame = createFrame({ layout: 'absolute', aspectRatio: 1 })

    expect(frame.aspectRatio).toBe(1)
  })

  test('accepts string number', () => {
    const frame = createFrame({ layout: 'absolute', aspectRatio: '1' })

    expect(frame.aspectRatio).toBe('1')
  })

  test('accepts ratio', () => {
    const frame = createFrame({ layout: 'absolute', aspectRatio: '16 / 9' })

    expect(frame.aspectRatio).toBe('16 / 9')
  })

  test('throws for invalid ratio', () => {
    expect(() =>
      createFrame({ layout: 'absolute', aspectRatio: '-1' }),
    ).toThrow()
  })
})
