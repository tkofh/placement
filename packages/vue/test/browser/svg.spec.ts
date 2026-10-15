import { afterEach, describe, expect, test } from 'vitest'
import { h, ref } from 'vue'
import { GraphicCircle } from '../../src/components/GraphicCircle.ts'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { GraphicLine } from '../../src/components/GraphicLine.ts'
import { GraphicPoint } from '../../src/components/GraphicPoint.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import { GraphicText } from '../../src/components/GraphicText.ts'
import { cleanup, mountInRoot, one, settle } from './mount.ts'

afterEach(cleanup)

const SVG_NS = 'http://www.w3.org/2000/svg'

describe('namespaces and element classes', () => {
  test('every rendered element is a real SVG element in the SVG namespace', async () => {
    const { svg } = await mountInRoot(() => [
      h(
        GraphicGroup,
        { debug: true },
        { default: () => [h(GraphicRect, { width: 10, height: 10 })] },
      ),
      h(GraphicCircle, { r: 5 }),
      h(GraphicCircle, { r: '5 8' }),
      h(GraphicLine, null, {
        default: () => [
          h(GraphicPoint, { left: 0, top: 0 }),
          h(GraphicPoint, { left: 10, top: 10 }),
        ],
      }),
      h(GraphicText, null, { default: () => 'hello' }),
    ])

    const elements = [...svg.querySelectorAll('*')]
    expect(elements.map((element) => element.localName)).toEqual([
      'g',
      'rect',
      'circle',
      'ellipse',
      'line',
      'text',
    ])
    for (const element of elements) {
      expect(element.namespaceURI).toBe(SVG_NS)
      expect(element).toBeInstanceOf(SVGElement)
    }
    expect(one(svg, 'rect')).toBeInstanceOf(SVGRectElement)
    expect(one(svg, 'circle')).toBeInstanceOf(SVGCircleElement)
    expect(one(svg, 'ellipse')).toBeInstanceOf(SVGEllipseElement)
    expect(one(svg, 'line')).toBeInstanceOf(SVGLineElement)
    expect(one(svg, 'text')).toBeInstanceOf(SVGTextElement)
  })
})

// Vue patches SVG elements through setAttribute, never through DOM
// properties. SVG geometry properties are read-only SVGAnimatedLength
// objects, so a property write throws or silently does nothing. The live
// baseVal shows that the browser parsed what the test wrote.
describe('geometry attributes', () => {
  test('rect writes attributes the browser parses into live lengths', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicRect, { left: 10, top: 20, width: 30, height: 40, r: 4 }),
    ])

    const rect = one<SVGRectElement>(svg, 'rect')
    expect(rect.getAttribute('x')).toBe('10')
    expect(rect.getAttribute('y')).toBe('20')
    expect(rect.x.baseVal.value).toBe(10)
    expect(rect.y.baseVal.value).toBe(20)
    expect(rect.width.baseVal.value).toBe(30)
    expect(rect.height.baseVal.value).toBe(40)
    expect(rect.rx.baseVal.value).toBe(4)
    expect(rect.ry.baseVal.value).toBe(4)
  })

  test('circle and ellipse centers and radii are parsed by the browser', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicCircle, { left: 10, top: 10, r: 5 }),
      h(GraphicCircle, { left: 50, top: 10, r: '5 8' }),
    ])

    const circle = one<SVGCircleElement>(svg, 'circle')
    expect(circle.r.baseVal.value).toBe(5)
    const ellipse = one<SVGEllipseElement>(svg, 'ellipse')
    expect(ellipse.rx.baseVal.value).toBe(5)
    expect(ellipse.ry.baseVal.value).toBe(8)
  })

  test('line endpoints come from registered points', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicLine, null, {
        default: () => [
          h(GraphicPoint, { left: 5, top: 6 }),
          h(GraphicPoint, { left: 50, top: 60 }),
        ],
      }),
    ])

    const line = one<SVGLineElement>(svg, 'line')
    expect([line.x1, line.y1, line.x2, line.y2].map((length) => length.baseVal.value)).toEqual([
      5, 6, 50, 60,
    ])
  })
})

describe('paint attributes', () => {
  test('presentation attributes are kebab-case and reach computed style', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicRect, {
        width: 10,
        height: 10,
        fill: 'rgb(255 0 0) evenodd',
        stroke: 'rgb(0 0 255) 3px join round cap square dashed 4 2',
        opacity: 0.5,
      }),
    ])

    const rect = one<SVGRectElement>(svg, 'rect')
    expect(rect.hasAttribute('stroke-width')).toBe(true)
    expect(rect.hasAttribute('strokeWidth')).toBe(false)

    const style = getComputedStyle(rect)
    // Chromium serializes the parsed color in whichever space the attribute
    // was written in.
    expect(style.fill).toMatch(/^(rgb\(255, 0, 0\)|color\(srgb 1 0 0\))$/)
    expect(style.fillRule).toBe('evenodd')
    expect(style.stroke).toMatch(/^(rgb\(0, 0, 255\)|color\(srgb 0 0 1\))$/)
    expect(style.strokeWidth).toBe('3px')
    expect(style.strokeLinejoin).toBe('round')
    expect(style.strokeLinecap).toBe('square')
    expect(style.strokeDasharray).toBe('4px, 2px')
    // `opacity` fans out to fill-opacity and stroke-opacity, not the
    // element-level opacity property.
    expect(style.fillOpacity).toBe('0.5')
    expect(style.strokeOpacity).toBe('0.5')
  })

  test('opacity 0 is written, not dropped as falsy', async () => {
    const { svg } = await mountInRoot(() => [h(GraphicRect, { width: 10, height: 10, opacity: 0 })])

    const style = getComputedStyle(one(svg, 'rect'))
    expect(style.fillOpacity).toBe('0')
    expect(style.strokeOpacity).toBe('0')
  })

  test('removing a paint prop removes the attribute rather than writing "undefined"', async () => {
    const fill = ref<string | undefined>('rgb(255 0 0)')
    const { svg } = await mountInRoot(() => [
      h(GraphicRect, { width: 10, height: 10, fill: fill.value }),
    ])
    const rect = one<SVGRectElement>(svg, 'rect')
    expect(rect.getAttribute('fill')).not.toBeNull()

    fill.value = undefined
    await settle()

    expect(rect.hasAttribute('fill')).toBe(false)
    expect(rect.hasAttribute('fill-rule')).toBe(false)
    // Back to the SVG default, black.
    expect(getComputedStyle(rect).fill).toBe('rgb(0, 0, 0)')
  })
})

describe('reactivity patches in place', () => {
  test('changing a prop updates attributes on the same element node', async () => {
    const width = ref(10)
    const { svg } = await mountInRoot(() => [h(GraphicRect, { width: width.value, height: 10 })])
    const rect = one<SVGRectElement>(svg, 'rect')

    width.value = 70
    await settle()

    expect(one(svg, 'rect')).toBe(rect)
    expect(rect.width.baseVal.value).toBe(70)
  })

  test('flipping circle to ellipse swaps the element and drops stale attributes', async () => {
    const radius = ref<'5' | '5 8'>('5')
    const { svg } = await mountInRoot(() => [h(GraphicCircle, { r: radius.value })])
    expect(svg.querySelector('circle')).not.toBeNull()

    radius.value = '5 8'
    await settle()

    expect(svg.querySelector('circle')).toBeNull()
    const ellipse = one<SVGEllipseElement>(svg, 'ellipse')
    expect(ellipse.hasAttribute('r')).toBe(false)
    expect(ellipse.ry.baseVal.value).toBe(8)
  })
})

describe('GraphicGroup in the SVG tree', () => {
  test('class and style fall through to a <g>; plain groups add no element', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicGroup, null, { default: () => [h(GraphicRect, { width: 1, height: 1 })] }),
      h(
        GraphicGroup,
        { class: 'styled' },
        { default: () => [h(GraphicRect, { width: 1, height: 1 })] },
      ),
    ])

    expect(svg.querySelectorAll('g')).toHaveLength(1)
    const group = one<SVGGElement>(svg, 'g')
    // SVG elements expose `className` as an SVGAnimatedString, so only the
    // attribute reads back reliably.
    expect(group.getAttribute('class')).toBe('styled')
    expect(group).toBeInstanceOf(SVGGElement)
    expect(group.childElementCount).toBe(1)
    expect(svg.querySelectorAll('rect')).toHaveLength(2)
  })

  test('debug groups carry their rect as attributes', async () => {
    const { svg } = await mountInRoot(() => [
      h(GraphicGroup, { debug: true, left: 4, top: 6, width: 20, height: 30 }),
    ])

    const group = one<SVGGElement>(svg, 'g')
    expect(['x', 'y', 'width', 'height'].map((name) => group.getAttribute(name))).toEqual([
      '4',
      '6',
      '20',
      '30',
    ])
  })
})
