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
import { useParentWidth, useRootHeight, useRootWidth } from './useSizingContext'

export interface PaintProps {
  fill?: FillInput
  opacity?: OpacityInput
  stroke?: StrokeInput
}

export const PAINT_PROP_KEYS = ['fill', 'opacity', 'stroke'] as const

export function usePaint(props: PaintProps) {
  const parentWidth = useParentWidth()
  const rootWidth = useRootWidth()
  const rootHeight = useRootHeight()

  const fill = computed(() =>
    props.fill ? resolveFill(props.fill) : Fill.empty,
  )
  const opacity = computed(() =>
    props.opacity ? resolveOpacity(props.opacity) : Opacity.empty,
  )
  const stroke = computed(() =>
    props.stroke
      ? resolveStroke(
          props.stroke,
          parentWidth.value,
          rootWidth.value,
          rootHeight.value,
        )
      : Stroke.empty,
  )

  return computed(() => ({
    ...fill.value,
    ...opacity.value,
    ...stroke.value,
  }))
}
