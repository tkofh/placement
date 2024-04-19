import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('sizing', () => {
  test('sizes can be defined by width and height', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })
    expect(frame.width).toBe('100px')
    expect(frame.height).toBe('100px')

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)
  })

  test('sizes can be defined by width & aspect ratio', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '1600px',
      aspectRatio: '16 / 9',
    })
    expect(frame.aspectRatio).toBe('16 / 9')

    expect(frame.rect.width).toBe(1600)
    expect(frame.rect.height).toBe(900)
  })

  test('sizes can be defined by height & aspect ratio', () => {
    const frame = createFrame({
      layout: 'absolute',
      height: '900px',
      aspectRatio: '16 / 9',
    })
    expect(frame.aspectRatio).toBe('16 / 9')

    expect(frame.rect.width).toBe(1600)
    expect(frame.rect.height).toBe(900)
  })

  test('produces zero when using relative sizes', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '100%',
      height: '100%',
    })

    expect(frame.rect.width).toBe(0)
    expect(frame.rect.height).toBe(0)
  })
})

describe('resizing', () => {
  test('width should be mutable', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    expect(frame.rect.width).toBe(100)

    frame.width = '200px'

    expect(frame.width).toBe('200px')
  })

  test('height should be mutable', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '100px',
      height: '100px',
    })

    expect(frame.rect.height).toBe(100)

    frame.height = '200px'

    expect(frame.height).toBe('200px')
  })

  test('aspect ratio should be mutable', () => {
    const frame = createFrame({
      layout: 'absolute',
      width: '100px',
      aspectRatio: '1 / 1',
    })

    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(100)

    frame.aspectRatio = '16 / 9'

    expect(frame.aspectRatio).toBe('16 / 9')
    expect(frame.rect.width).toBe(100)
    expect(frame.rect.height).toBe(56.25)
  })
})
