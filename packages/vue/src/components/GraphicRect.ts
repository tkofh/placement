import { CubicPath2d } from 'curvy/path'
import { computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { RADIUS_PROP_KEYS, type RadiusProps, useRadius } from '../composables/useRadius.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { roundRect } from '../internal/corners.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'

export interface GraphicRectProps extends PaintProps, RectProps, RadiusProps {
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, elliptical corners) to `1` (fully smoothed, squircle-like).
   * A smoothed corner reaches `(1 + smoothing)` radii along each side, and
   * gives up smoothing before radius when the side is too short.
   */
  smoothing?: SmoothingInput
}

export const GraphicRect = defineComponent(
  (props: GraphicRectProps) => {
    const self = useRect(props)

    const radius = useRadius(props)

    const paint = usePaint(props)

    // Smoothed corners need a path. Plain corners keep the native rect.
    const smoothed = computed(() => {
      const smoothing = resolveSmoothing(props.smoothing)
      const { x: rx, y: ry } = radius.value
      if (smoothing === 0 || !(rx > 0) || !(ry > 0)) {
        return undefined
      }
      const { x, y, width, height } = self.value
      return `${CubicPath2d.toPathData(roundRect(x, y, width, height, rx, ry, smoothing))} Z`
    })

    return () => {
      const d = smoothed.value
      if (d !== undefined) {
        return h('path', { d, ...paint.value })
      }
      const { x, y, width, height } = self.value
      const { x: rx, y: ry } = radius.value
      return h('rect', {
        x,
        y,
        width,
        height,
        rx,
        ry,
        ...paint.value,
      })
    }
  },
  {
    name: 'GraphicRect',
    props: [...RECT_PROP_KEYS, ...RADIUS_PROP_KEYS, ...PAINT_PROP_KEYS, 'smoothing'],
  },
)
