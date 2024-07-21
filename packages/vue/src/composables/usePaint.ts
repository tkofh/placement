import type { Dimensions } from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { Fill, type FillInput, parseFill } from '../internal/props/fill'
import {
  Opacity,
  type OpacityInput,
  parseOpacity,
} from '../internal/props/opacity'
import { Stroke, type StrokeInput, parseStroke } from '../internal/props/stroke'

export interface PaintProps {
  fill?: FillInput
  opacity?: OpacityInput
  stroke?: StrokeInput
}

export const PAINT_PROP_KEYS = ['fill', 'opacity', 'stroke'] as const

export function usePaint(
  props: PaintProps,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const fill = computed(() => (props.fill ? parseFill(props.fill) : Fill.empty))
  const opacity = computed(() =>
    props.opacity ? parseOpacity(props.opacity) : Opacity.empty,
  )
  const stroke = computed(() =>
    props.stroke
      ? parseStroke(props.stroke, toValue(parent), toValue(root))
      : Stroke.empty,
  )

  return computed(() => ({
    ...fill.value,
    ...opacity.value,
    ...stroke.value,
  }))
}
