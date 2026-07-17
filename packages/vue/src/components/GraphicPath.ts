import { Affine2d } from 'curvy/transform'
import { computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext.ts'
import {
  type PathInput,
  type RenderablePath,
  finiteNumber,
  normalizePath,
  pathBounds,
  pathData,
  transformPath,
} from '../internal/curve.ts'

export type { PathInput }

export type PathFit = 'none' | 'contain' | 'cover' | 'fill'

export interface GraphicPathProps extends PaintProps {
  /**
   * A curvy path or spline. Splines convert through their `toPath`;
   * rational forms are approximated as cubic paths to `tolerance`.
   */
  path?: PathInput
  /**
   * How the path's coordinates meet the parent rect: `'none'` (default)
   * reads them as parent-local pixels; the others map the path's bounding
   * box onto the parent — `'fill'` stretches each axis, `'contain'` and
   * `'cover'` scale uniformly and center.
   */
  fit?: PathFit
  /** Certified Hausdorff bound for rational approximation, in output pixels. */
  tolerance?: number | `${number}`
}

export const GraphicPath = defineComponent(
  (props: GraphicPathProps, { attrs }) => {
    const parentX = useParentX()
    const parentY = useParentY()
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()

    const renderable = computed(() =>
      props.path === undefined
        ? null
        : normalizePath(props.path, finiteNumber(props.tolerance) ?? 0.25),
    )

    const fitted = computed((): RenderablePath | null => {
      const path = renderable.value
      if (path === null) {
        return null
      }

      const fit = props.fit ?? 'none'
      if (fit === 'none') {
        return transformPath(path, Affine2d.translate(parentX.value, parentY.value))
      }

      const box = pathBounds(path)
      const boxWidth = box.x.end - box.x.start
      const boxHeight = box.y.end - box.y.start

      let scaleX: number
      let scaleY: number
      if (fit === 'fill') {
        scaleX = boxWidth > 0 ? parentWidth.value / boxWidth : 1
        scaleY = boxHeight > 0 ? parentHeight.value / boxHeight : 1
      } else {
        const candidates: Array<number> = []
        if (boxWidth > 0) {
          candidates.push(parentWidth.value / boxWidth)
        }
        if (boxHeight > 0) {
          candidates.push(parentHeight.value / boxHeight)
        }
        const scale =
          candidates.length === 0
            ? 1
            : fit === 'cover'
              ? Math.max(...candidates)
              : Math.min(...candidates)
        scaleX = scale
        scaleY = scale
      }

      // Scale about the box origin, then land it centered in the parent
      // (fill centering is exact: the scaled box equals the parent).
      const x = parentX.value + (parentWidth.value - boxWidth * scaleX) / 2 - box.x.start * scaleX
      const y = parentY.value + (parentHeight.value - boxHeight * scaleY) / 2 - box.y.start * scaleY

      return transformPath(
        path,
        Affine2d.scale(scaleX, scaleY).pipe(Affine2d.andThen(Affine2d.translate(x, y))),
      )
    })

    const paint = usePaint(props)

    return () => {
      const path = fitted.value
      if (path === null) {
        return null
      }
      return h('path', {
        d: pathData(path),
        ...attrs,
        ...paint.value,
        // An SVG path with no fill attribute fills black; default to a
        // stroke-only shape and let an explicit fill opt in.
        fill: paint.value.fill ?? 'none',
      })
    }
  },
  {
    name: 'GraphicPath',
    props: ['path', 'fit', 'tolerance', ...PAINT_PROP_KEYS],
    inheritAttrs: false,
  },
)
