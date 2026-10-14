import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import { afterEach, describe, expect, test } from 'vitest'
import { h, ref } from 'vue'
import { GraphicCircle } from '../../src/components/GraphicCircle.ts'
import { GraphicCurve } from '../../src/components/GraphicCurve.ts'
import { GraphicPath } from '../../src/components/GraphicPath.ts'
import { GraphicPoint } from '../../src/components/GraphicPoint.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import { GraphicText } from '../../src/components/GraphicText.ts'
import { cleanup, mountInRoot, one, settle } from './mount.ts'

afterEach(cleanup)

// These cover the browser round trips the unit suite fakes: a real
// ResizeObserver on an <svg>, real text metrics, and the viewBox mapping
// user units onto device pixels. They assert wiring, not solver output.
describe('GraphicRoot measurement', () => {
  test('viewBox adopts the real rendered size of the <svg>', async () => {
    const { svg } = await mountInRoot(() => [], {}, { width: 300, height: 150 })

    expect(svg.getAttribute('viewBox')).toBe('0 0 300 150')
    expect(svg.viewBox.baseVal.width).toBe(300)
    expect(svg.viewBox.baseVal.height).toBe(150)
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none')
  })

  test('resizing the container re-measures and updates the viewBox', async () => {
    const { svg, container } = await mountInRoot(() => [], {}, { width: 300, height: 150 })

    container.style.width = '120px'
    container.style.height = '60px'
    await settle()

    expect(svg.getAttribute('viewBox')).toBe('0 0 120 60')
  })

  test('user units map 1:1 to pixels when the viewBox matches the size', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicRect, { left: 10, top: 20, width: 30, height: 40 })],
      {},
      { width: 200, height: 100 },
    )

    const svgBox = svg.getBoundingClientRect()
    const rectBox = one<SVGRectElement>(svg, 'rect').getBoundingClientRect()
    expect(rectBox.left - svgBox.left).toBeCloseTo(10)
    expect(rectBox.top - svgBox.top).toBeCloseTo(20)
    expect(rectBox.width).toBeCloseTo(30)
    expect(rectBox.height).toBeCloseTo(40)
  })

  test('percent sizes resolve against the measured size', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicRect, { width: '50%', height: '25%' })],
      {},
      { width: 200, height: 100 },
    )

    const rect = one<SVGRectElement>(svg, 'rect')
    expect(rect.width.baseVal.value).toBe(100)
    expect(rect.height.baseVal.value).toBe(25)
  })

  test('fit="contain" letterboxes a smaller content rect in real device pixels', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicRect, { width: '100%', height: '100%' })],
      { width: 100, height: 100, fit: 'contain' },
      { width: 200, height: 100 },
    )

    // The 100x100 content rect keeps its proportions inside the 200x100
    // svg: a centered square, not a stretched rectangle.
    const svgBox = svg.getBoundingClientRect()
    const rectBox = one<SVGRectElement>(svg, 'rect').getBoundingClientRect()
    expect(rectBox.width).toBeCloseTo(rectBox.height)
    expect(rectBox.width).toBeCloseTo(100)
    expect(rectBox.left - svgBox.left).toBeCloseTo(50)
  })

  test('unmounting disconnects the observer without throwing', async () => {
    const { app, container } = await mountInRoot(() => [], {}, { width: 100, height: 100 })

    app.unmount()
    container.style.width = '50px'
    await settle()

    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('GraphicText measurement', () => {
  test('measures real glyph metrics and positions the text from the measured box', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicText, { left: 10, top: 10, fill: 'black' }, { default: () => 'Measure me' })],
      {},
      { width: 300, height: 100 },
    )

    const text = one<SVGTextElement>(svg, 'text')
    const bbox = text.getBBox()
    expect(bbox.width).toBeGreaterThan(0)
    expect(bbox.height).toBeGreaterThan(0)
    expect(bbox.x).toBeCloseTo(10, 0)
    // `y` is the baseline: the top inset plus the measured height.
    expect(Number(text.getAttribute('y'))).toBeCloseTo(10 + Number(text.getAttribute('height')))
  })

  // SVG text sits on its baseline, but the component treats the measured
  // box bottom as the baseline, so the font's descent pushes the visible
  // glyph box below the requested inset. Flip to a plain `test` once fixed.
  test.fails('the rendered glyph box starts at the top inset', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicText, { left: 10, top: 10 }, { default: () => 'Measure me' })],
      {},
      { width: 300, height: 100 },
    )

    expect(one<SVGTextElement>(svg, 'text').getBBox().y).toBeCloseTo(10, 0)
  })

  test('longer text measures wider and re-lays out', async () => {
    const content = ref('i')
    const { svg } = await mountInRoot(
      () => [h(GraphicText, { right: 0, top: 0 }, { default: () => content.value })],
      {},
      { width: 300, height: 100 },
    )
    const text = one<SVGTextElement>(svg, 'text')
    const before = text.getBBox()

    content.value = 'iiiiiiiiiiiiiiiiiiii'
    await settle()
    await settle()

    const after = text.getBBox()
    expect(after.width).toBeGreaterThan(before.width)
    // Right-anchored: the right edge stays on the container edge.
    expect(after.x + after.width).toBeCloseTo(300, 0)
  })
})

const closedTrianglePoints = () => [
  h(GraphicPoint, { left: 10, top: 10 }),
  h(GraphicPoint, { left: 50, top: 10 }),
  h(GraphicPoint, { left: 50, top: 50 }),
]

describe('path rendering', () => {
  test('GraphicCurve emits path data the browser parses and strokes', async () => {
    const { svg } = await mountInRoot(
      () => [
        h(
          GraphicCurve,
          { stroke: 'black 2px' },
          {
            default: () => [
              h(GraphicPoint, { left: 10, top: 10 }),
              h(GraphicPoint, { left: 60, top: 80 }),
              h(GraphicPoint, { left: 110, top: 20 }),
              h(GraphicPoint, { left: 160, top: 70 }),
            ],
          },
        ),
      ],
      {},
      { width: 200, height: 100 },
    )

    const path = one<SVGPathElement>(svg, 'path')
    expect(path.getAttribute('d')).toMatch(/^M/)
    expect(path.getTotalLength()).toBeGreaterThan(150)
    expect(getComputedStyle(path).fill).toBe('none')
    const bbox = path.getBBox()
    expect(bbox.x).toBeCloseTo(10, 0)
    expect(bbox.x + bbox.width).toBeCloseTo(160, 0)
  })

  test('closed curves end in Z and include the closing segment in their length', async () => {
    const open = await mountInRoot(() => [
      h(GraphicCurve, { curve: 'linear' }, { default: closedTrianglePoints }),
    ])
    const closed = await mountInRoot(() => [
      h(GraphicCurve, { curve: 'linear', closed: true }, { default: closedTrianglePoints }),
    ])

    const closedPath = one<SVGPathElement>(closed.svg, 'path')
    expect(closedPath.getAttribute('d')).toMatch(/Z$/)
    expect(one<SVGPathElement>(open.svg, 'path').getTotalLength()).toBeCloseTo(80)
    expect(closedPath.getTotalLength()).toBeCloseTo(80 + Math.hypot(40, 40))
  })

  test('GraphicPath fit="fill" scales the path box onto the parent in pixels', async () => {
    const path = Linear2d.toPath(
      Linear2d.fromArray([Vector2.make(0, 0), Vector2.make(10, 5), Vector2.make(20, 0)]),
    )
    const { svg } = await mountInRoot(
      () => [h(GraphicPath, { path, fit: 'fill', stroke: 'black' })],
      {},
      { width: 200, height: 100 },
    )

    const bbox = one<SVGPathElement>(svg, 'path').getBBox()
    expect(bbox.x).toBeCloseTo(0)
    expect(bbox.y).toBeCloseTo(0)
    expect(bbox.width).toBeCloseTo(200)
    expect(bbox.height).toBeCloseTo(100)
  })

  test('a circle stays round: bounding box matches the radius in pixels', async () => {
    const { svg } = await mountInRoot(
      () => [h(GraphicCircle, { left: 50, top: 50, r: 20 })],
      {},
      { width: 200, height: 100 },
    )

    const box = one<SVGCircleElement>(svg, 'circle').getBoundingClientRect()
    expect(box.width).toBeCloseTo(40)
    expect(box.height).toBeCloseTo(40)
  })
})
