import { describe, expect, test } from 'vitest'
import { FlexFrame } from '../src/FlexFrame'
import { Frame } from '../src/Frame'

describe('properties', () => {
  describe('direction', () => {
    test('row', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row' },
      )
      expect(layout.direction).toBe('row')

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })
    })

    test('row reverse', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row-reverse' },
      )

      expect(layout.direction).toBe('row-reverse')

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 50, y: 0 })
      expect(child2.computed).toMatchObject({ x: 0, y: 0 })
    })

    test('column', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'column' },
      )
      expect(layout.direction).toBe('column')

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 0, y: 50 })
    })

    test('column reverse', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'column-reverse' },
      )
      expect(layout.direction).toBe('column-reverse')

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 50 })
      expect(child2.computed).toMatchObject({ x: 0, y: 0 })
    })

    test('changing direction', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row' },
      )

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(layout.direction).toBe('row')
      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })

      layout.direction = 'column'

      expect(layout.direction).toBe('column')
      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 0, y: 50 })
    })
  })

  describe('wrap', () => {
    test('no wrap', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row', wrap: false },
      )

      expect(layout.wrap).toBe(false)

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child3 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })
      expect(child3.computed).toMatchObject({ x: 100, y: 0 })
    })

    test('wrap', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row', wrap: true },
      )

      expect(layout.wrap).toBe(true)

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child3 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })
      expect(child3.computed).toMatchObject({ x: 0, y: 50 })
    })

    test('wrap reverse', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row', wrap: 'reverse' },
      )

      expect(layout.wrap).toBe('reverse')

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child3 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(child1.computed).toMatchObject({ x: 0, y: 50 })
      expect(child2.computed).toMatchObject({ x: 50, y: 50 })
      expect(child3.computed).toMatchObject({ x: 0, y: 0 })
    })

    test('changing wrap', () => {
      const layout = new FlexFrame(
        { width: 100, height: 100 },
        { direction: 'row', wrap: false },
      )

      const child1 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child2 = layout.appendChild(new Frame({ width: 50, height: 50 }))
      const child3 = layout.appendChild(new Frame({ width: 50, height: 50 }))

      expect(layout.wrap).toBe(false)
      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })
      expect(child3.computed).toMatchObject({ x: 100, y: 0 })

      layout.wrap = true

      expect(layout.wrap).toBe(true)
      expect(child1.computed).toMatchObject({ x: 0, y: 0 })
      expect(child2.computed).toMatchObject({ x: 50, y: 0 })
      expect(child3.computed).toMatchObject({ x: 0, y: 50 })
    })
  })
})
