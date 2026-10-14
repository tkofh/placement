import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type MaybeRefOrGetter, defineComponent, h, nextTick, shallowRef } from 'vue'
import { type PaintProps, usePaint } from '../../src/composables/usePaint.ts'
import { mountWithRect } from '../host.ts'

// The three prop groups spread into one object of kebab-case SVG attribute
// keys; an unset group still contributes its keys, valued undefined.
const emptyPaint = {
  fill: undefined,
  'fill-rule': undefined,
  'fill-opacity': undefined,
  'stroke-opacity': undefined,
  stroke: undefined,
  'stroke-width': undefined,
  'stroke-dasharray': undefined,
  'stroke-dashoffset': undefined,
  'stroke-linecap': undefined,
  'stroke-linejoin': undefined,
  'stroke-miterlimit': undefined,
}

function mountPaint(
  props: PaintProps,
  rect: MaybeRefOrGetter<Rect.Rect> = Rect.make(0, 0, 200, 100),
): ReturnType<typeof usePaint> {
  let paint!: ReturnType<typeof usePaint>
  const Probe = defineComponent({
    name: 'Probe',
    setup() {
      paint = usePaint(props)
      return () => null
    },
  })
  mountWithRect(rect, () => [h(Probe)])
  return paint
}

describe('resolution', () => {
  test('no props resolve to all-undefined attribute keys', () => {
    expect(mountPaint({}).value).toStrictEqual(emptyPaint)
  })

  test('fill, opacity, and stroke merge into one attribute object', () => {
    const paint = mountPaint({ fill: 'red evenodd', opacity: 0.5, stroke: 'blue 10px' })

    expect(paint.value).toStrictEqual({
      ...emptyPaint,
      fill: 'color(srgb 1 0 0)',
      'fill-rule': 'evenodd',
      'fill-opacity': 0.5,
      'stroke-opacity': 0.5,
      stroke: 'color(srgb 0 0 1)',
      'stroke-width': '10px',
    })
  })

  test('numeric opacity 0 reaches the resolver', () => {
    const paint = mountPaint({ opacity: 0 })

    expect(paint.value['fill-opacity']).toBe(0)
    expect(paint.value['stroke-opacity']).toBe(0)
  })
})

describe('percent basis', () => {
  test('stroke width percentage resolves against the parent width and tracks it', async () => {
    const rect = shallowRef(Rect.make(0, 0, 200, 100))
    const paint = mountPaint({ stroke: 'red 10%' }, rect)
    await nextTick()

    expect(paint.value['stroke-width']).toBe('20px')

    rect.value = Rect.make(0, 0, 400, 100)
    await nextTick()

    expect(paint.value['stroke-width']).toBe('40px')
  })
})
