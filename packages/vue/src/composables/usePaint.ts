import { computed } from 'vue'
import { Fill, type FillInput, resolveFill } from '../internal/props/fill'
import {
  Opacity,
  type OpacityInput,
  resolveOpacity,
} from '../internal/props/opacity'
import {
  Stroke,
  type StrokeInput,
  resolveStroke,
} from '../internal/props/stroke'
import { useParentWidth } from './useSizingContext'

export interface StrokeProps {
  stroke?: StrokeInput
  opacity?: OpacityInput
}
export const STROKE_PROP_KEYS = ['opacity', 'stroke'] as const

export interface FillProps {
  fill?: FillInput
  opacity?: OpacityInput
}
export const FILL_PROP_KEYS = ['opacity', 'fill'] as const

export interface PaintProps extends FillProps, StrokeProps {}

export const PAINT_PROP_KEYS = ['fill', 'opacity', 'stroke'] as const

export function usePaint(props: PaintProps) {
  const parentWidth = useParentWidth()

  const fill = computed(() =>
    props.fill ? resolveFill(props.fill) : Fill.empty,
  )
  const opacity = computed(() =>
    props.opacity ? resolveOpacity(props.opacity) : Opacity.empty,
  )
  const stroke = computed(() =>
    props.stroke
      ? resolveStroke(props.stroke, parentWidth.value)
      : Stroke.empty,
  )

  return computed(() => ({
    ...fill.value,
    ...opacity.value,
    ...stroke.value,
  }))
}
