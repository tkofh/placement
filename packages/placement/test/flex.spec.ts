// noinspection DuplicatedCode

import { describe, expect, test } from 'vitest'
import { createFrame } from '../src/frame/createFrame'

describe('properties', () => {
  describe('flexDirection', () => {
    test('row', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
      })
      expect(layout.flexDirection).toBe('row')

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
    })

    test('row reverse', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row-reverse',
      })

      expect(layout.flexDirection).toBe('row-reverse')

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
    })

    test('column', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'column',
      })
      expect(layout.flexDirection).toBe('column')

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
    })

    test('column reverse', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'column-reverse',
      })
      expect(layout.flexDirection).toBe('column-reverse')

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
    })

    test('changing flexDirection', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
      })

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(layout.flexDirection).toBe('row')
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })

      layout.flexDirection = 'column'

      expect(layout.flexDirection).toBe('column')
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
    })
  })

  describe('flexWrap', () => {
    test('no flexWrap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'nowrap',
      })

      expect(layout.flexWrap).toBe(false)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(child3.rect).toMatchObject({ x: 100, y: 0, width: 50, height: 50 })
    })

    test('flexWrap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
      })

      expect(layout.flexWrap).toBe(true)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(child3.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
    })

    test('flexWrap reverse', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap-reverse',
      })

      expect(layout.flexWrap).toBe('reverse')

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 50, width: 50, height: 50 })
      expect(child3.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
    })

    test('changing flexWrap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'nowrap',
      })

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 50 }),
      )

      expect(layout.flexWrap).toBe(false)
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(child3.rect).toMatchObject({ x: 100, y: 0, width: 50, height: 50 })

      layout.flexWrap = 'wrap'

      expect(layout.flexWrap).toBe(true)
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 50 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(child3.rect).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
    })
  })

  describe('gap', () => {
    test('gap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        gap: 10,
      })

      expect(layout.gap).toBe(10)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 20, y: 0, width: 10, height: 10 })
    })

    test('allows negative gap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        gap: -10,
      })

      expect(layout.gap).toBe(-10)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
    })

    test('changing gap', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        gap: 10,
      })

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(layout.gap).toBe(10)
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 20, y: 0, width: 10, height: 10 })

      layout.gap = 20

      expect(layout.gap).toBe(20)
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 30, y: 0, width: 10, height: 10 })
    })
  })

  describe('justify', () => {
    test('justify start (0)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        justify: 0,
      })

      expect(layout.justify).toBe(0)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 10 })
    })

    test('justify middle (0.5)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        justify: 0.5,
      })

      expect(layout.justify).toBe(0.5)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 40, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 10, height: 10 })
    })

    test('justify end (1)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        justify: 1,
      })

      expect(layout.justify).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 80, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 90, y: 0, width: 10, height: 10 })
    })

    test('justify on multiple lines', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 20,
        height: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justify: 0.5,
      })

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 10 })
      expect(child3.rect).toMatchObject({ x: 5, y: 10, width: 10, height: 10 })
    })
  })

  describe('align', () => {
    test('align start (0)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        align: 0,
      })

      expect(layout.align).toBe(0)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 20 })
    })

    test('align middle (0.5)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        align: 0.5,
      })

      expect(layout.align).toBe(0.5)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 45, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 40, width: 10, height: 20 })
    })

    test('align end(1)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        align: 1,
      })

      expect(layout.align).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 90, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 80, width: 10, height: 20 })
    })

    test('align on multiple lines', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 20,
        height: 40,
        flexDirection: 'row',
        flexWrap: 'wrap',
        align: 0.5,
      })

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child4 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 5, width: 10, height: 10 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 25, width: 10, height: 10 })
      expect(child4.rect).toMatchObject({ x: 10, y: 20, width: 10, height: 20 })
    })
  })

  describe('stretch', () => {
    test('full stretch', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        stretch: 1,
      })

      expect(layout.stretch).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 100 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 100 })
    })

    test('partial stretch', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        stretch: 0.5,
      })

      expect(layout.stretch).toBe(0.5)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 10, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 10, height: 55 })
      expect(child2.rect).toMatchObject({ x: 10, y: 0, width: 10, height: 60 })
    })
  })

  describe('linesAlign', () => {
    test('lines align start (0)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        linesAlign: 0,
      })

      expect(layout.linesAlign).toBe(0)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 10 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 20, width: 50, height: 10 })
    })

    test('lines align mid (0.5)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        linesAlign: 0.5,
      })

      expect(layout.linesAlign).toBe(0.5)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 35, width: 50, height: 10 })
      expect(child2.rect).toMatchObject({ x: 50, y: 35, width: 50, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 55, width: 50, height: 10 })
    })

    test('lines align end (1)', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        linesAlign: 1,
      })

      expect(layout.linesAlign).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )
      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 70, width: 50, height: 10 })
      expect(child2.rect).toMatchObject({ x: 50, y: 70, width: 50, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 90, width: 50, height: 10 })
    })
  })

  describe('linesStretch', () => {
    test('default behavior', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        stretch: 1,
      })

      expect(layout.linesStretch).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 100 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 100 })

      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(layout.linesStretch).toBe(0)
      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 20 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 20, width: 50, height: 10 })
    })

    test('no stretch', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        stretch: 1,
        linesStretch: 0,
      })

      expect(layout.linesStretch).toBe(0)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 20 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 20 })

      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 20 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 20 })
      expect(child3.rect).toMatchObject({ x: 0, y: 20, width: 50, height: 10 })
    })

    test('partial stretch', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        stretch: 1,
        linesStretch: 0.5,
      })

      expect(layout.linesStretch).toBe(0.5)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 60 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 60 })

      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 37.5 })
      expect(child2.rect).toMatchObject({
        x: 50,
        y: 0,
        width: 50,
        height: 37.5,
      })
      expect(child3.rect).toMatchObject({
        x: 0,
        y: 20,
        width: 50,
        height: 27.5,
      })
    })

    test('full stretch', () => {
      const layout = createFrame({
        layout: 'flex',
        width: 100,
        height: 100,
        flexDirection: 'row',
        flexWrap: 'wrap',
        stretch: 1,
        linesStretch: 1,
      })

      expect(layout.linesStretch).toBe(1)

      const child1 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )
      const child2 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 20 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 100 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 100 })

      const child3 = layout.appendChild(
        createFrame({ layout: 'flex', width: 50, height: 10 }),
      )

      expect(child1.rect).toMatchObject({ x: 0, y: 0, width: 50, height: 55 })
      expect(child2.rect).toMatchObject({ x: 50, y: 0, width: 50, height: 55 })
      expect(child3.rect).toMatchObject({ x: 0, y: 20, width: 50, height: 45 })
    })
  })
})
