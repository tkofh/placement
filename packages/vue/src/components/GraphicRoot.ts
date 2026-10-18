import * as Box from 'placement/box'
import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { useDomRect } from '../composables/useDomRect.ts'
import {
  ORIGIN_PROP_KEYS,
  type OriginProps,
  SIZE_PROP_KEYS,
  type SizeProps,
  type TransformProps,
  useXYTranslation,
} from '../composables/useRect.ts'
import { useSizingContextRoot } from '../composables/useSizingContext.ts'
import { resolveAspectRatio } from '../internal/props/aspectRatio.ts'
import { toLength } from '../internal/props/size1d.ts'
import { provideShouldRenderGroups } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { useOrigin } from '../props/origin.ts'

export type FitInput = 'contain' | 'cover' | 'crop'

export interface GraphicRootProps extends SizeProps, TransformProps, OriginProps {
  fit?: FitInput
  debugGroups?: boolean
}

export const GraphicRoot = defineComponent(
  (props: GraphicRootProps, { slots }) => {
    const svg = shallowRef<SVGElement>()
    const domRect = useDomRect(svg)

    // The measured <svg> is both the percent basis and the fill target. A
    // dimension that the props leave undetermined falls back to the measured
    // size, constrained, and `Box.apply` resolves percentages against it
    // (see `placement/box`).
    const box = computed(() =>
      Box.make({
        width: toLength(props.width, Number.NaN),
        height: toLength(props.height, Number.NaN),
        aspectRatio: resolveAspectRatio(props.aspectRatio, Number.NaN),
        minWidth: toLength(props.minWidth, Number.NaN),
        minHeight: toLength(props.minHeight, Number.NaN),
        maxWidth: toLength(props.maxWidth, Number.NaN),
        maxHeight: toLength(props.maxHeight, Number.NaN),
      }),
    )

    const rootRect = computed(() =>
      Box.apply(box.value, Rect.make(domRect.value.width, domRect.value.height)),
    )

    const origin = useOrigin(() => props.origin, Point.half)
    const translation = useXYTranslation(props, domRect)

    const viewBox = computed(() => {
      const fit = props.fit ?? 'crop'
      let viewBoxRect: Rect.Rect
      if (fit === 'crop') {
        viewBoxRect = domRect.value.pipe(Rect.align(rootRect.value, origin.value))
      } else {
        viewBoxRect = domRect.value.pipe(
          // These are reversed (cover vs contain) because the viewBox is
          // the "parent" rect here. When the viewBox "covers" the rootRect,
          // the rootRect is "contained" by the viewBox.
          fit === 'cover' ? Rect.contain(rootRect.value, 0) : Rect.cover(rootRect.value, 0),
          Rect.align(rootRect.value, origin.value),
        )
      }

      viewBoxRect = translation.value(viewBoxRect)

      return `${viewBoxRect.x} ${viewBoxRect.y} ${viewBoxRect.width} ${viewBoxRect.height}`
    })

    useSizingContextRoot(rootRect)

    provideShouldRenderGroups(() => (boolProp(props.debugGroups) ? 2 : 0))

    return () => {
      return h(
        'svg',
        { ref: svg, viewBox: viewBox.value, preserveAspectRatio: 'none' },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicRoot',
    props: [...SIZE_PROP_KEYS, ...ORIGIN_PROP_KEYS, 'fit', 'debugGroups'],
  },
)
