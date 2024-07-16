import { type Dimensions, clamp, dimensions } from 'placement/dimensions'
import { isDimensions } from 'placement/dimensions'
import { type Point, isPoint, point } from 'placement/point'
import { type Rect, align, contain, cover, rect } from 'placement/rect'
import { computed, defineComponent, h, shallowRef, watchEffect } from 'vue'
import { useDomRect } from '../composables/useDomRect'
import {
  type AspectRatioInput,
  parseAspectRatio,
} from '../internal/props/aspectRatio'
import type { FitInput } from '../internal/props/fit'
import { type OriginInput, parseOrigin } from '../internal/props/origin'
import { type Size1DInput, parseSize1D } from '../internal/props/size1d'
import { type Size2DInput, parseSize2D } from '../internal/props/size2d'

export interface GraphicRootProps {
  origin?: OriginInput | Point | number
  fit?: FitInput
  size?: Size2DInput | Dimensions | number
  width?: Size1DInput | number
  height?: Size1DInput | number
  aspectRatio?: AspectRatioInput | number
  minWidth?: Size1DInput | number
  minHeight?: Size1DInput | number
  maxWidth?: Size1DInput | number
  maxHeight?: Size1DInput | number
  minSize?: Size2DInput | Dimensions | number
  maxSize?: Size2DInput | Dimensions | number
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: todo: make better
function resolveSize(
  domRect: Rect,
  auto: number,
  size: Size2DInput | Dimensions | number | undefined,
  width: Size1DInput | number | undefined,
  height: Size1DInput | number | undefined,
  aspectRatio: AspectRatioInput | number | undefined,
) {
  const sizeProp = isDimensions(size)
    ? (size as Dimensions)
    : typeof size === 'number'
      ? dimensions(size)
      : parseSize2D(
          (size as string) ?? '',
          Number.POSITIVE_INFINITY,
          domRect,
          domRect,
        )

  if (
    sizeProp.width < Number.POSITIVE_INFINITY &&
    sizeProp.height < Number.POSITIVE_INFINITY
  ) {
    return sizeProp
  }

  const widthProp =
    typeof width === 'number'
      ? width
      : parseSize1D(
          (width as string) ?? '',
          'width',
          Number.POSITIVE_INFINITY,
          domRect,
          domRect,
        )

  const heightProp =
    typeof height === 'number'
      ? height
      : parseSize1D(
          (height as string) ?? '',
          'height',
          Number.POSITIVE_INFINITY,
          domRect,
          domRect,
        )

  if (
    widthProp < Number.POSITIVE_INFINITY &&
    heightProp < Number.POSITIVE_INFINITY
  ) {
    return dimensions(widthProp, heightProp)
  }

  const aspectRatioProp =
    typeof aspectRatio === 'number'
      ? aspectRatio
      : parseAspectRatio((aspectRatio as string) ?? '')

  if (
    aspectRatioProp < Number.POSITIVE_INFINITY &&
    widthProp < Number.POSITIVE_INFINITY
  ) {
    return dimensions(widthProp, widthProp / aspectRatioProp)
  }

  if (
    aspectRatioProp < Number.POSITIVE_INFINITY &&
    heightProp < Number.POSITIVE_INFINITY
  ) {
    return dimensions(heightProp * aspectRatioProp, heightProp)
  }

  return dimensions(
    widthProp === Number.POSITIVE_INFINITY ? auto : widthProp,
    heightProp === Number.POSITIVE_INFINITY ? auto : heightProp,
  )
}

export const GraphicRoot = defineComponent(
  (props: GraphicRootProps, { slots }) => {
    const svg = shallowRef<SVGElement>()
    const domRect = useDomRect(svg)

    const size = computed(() =>
      resolveSize(
        domRect.value,
        0,
        props.size,
        props.width,
        props.height,
        props.aspectRatio,
      ),
    )
    const minSize = computed(() =>
      resolveSize(
        domRect.value,
        0,
        props.minSize,
        props.minWidth,
        props.minHeight,
        Number.POSITIVE_INFINITY,
      ),
    )
    const maxSize = computed(() =>
      resolveSize(
        domRect.value,
        Number.POSITIVE_INFINITY,
        props.maxSize,
        props.maxWidth,
        props.maxHeight,
        Number.POSITIVE_INFINITY,
      ),
    )

    const rootRect = computed(() =>
      rect.fromDimensions(clamp(size.value, minSize.value, maxSize.value)),
    )

    const origin = computed(() =>
      props.origin == null
        ? point(0)
        : isPoint(props.origin)
          ? props.origin
          : typeof props.origin === 'number'
            ? point(props.origin)
            : parseOrigin(props.origin),
    )

    const fit = computed(() => props.fit ?? 'contain')

    const viewBox = computed(() => {
      let viewBoxRect!: Rect
      if (fit.value === 'crop') {
        viewBoxRect = domRect.value.pipe(align(rootRect.value, origin.value))
      } else {
        const contentSpaceDomRect = domRect.value.pipe(
          fit.value === 'contain'
            ? contain(rootRect.value)
            : cover(rootRect.value),
        )
        viewBoxRect = rootRect.value.pipe(
          align(contentSpaceDomRect, origin.value),
        )
      }

      return `${viewBoxRect.x} ${viewBoxRect.y} ${viewBoxRect.width} ${viewBoxRect.height}`
    })

    watchEffect(() => {
      console.log({
        domRect: domRect.value,
        size: size.value,
        minSize: minSize.value,
        maxSize: maxSize.value,
        rootRect: rootRect.value,
        origin: origin.value,
        fit: fit.value,
        viewBox: viewBox.value,
      })
    })

    return () => {
      return h('svg', { ref: svg, viewBox: viewBox.value }, slots.default?.())
    }
  },
  {
    name: 'GraphicRoot',
    props: [
      'aspectRatio',
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'minSize',
      'maxSize',
      'size',
      'origin',
      'fit',
    ],
  },
)

// import type { ReadonlyRect } from 'placement/rect'
// import {
//   type PropType,
//   type SlotsType,
//   computed,
//   defineComponent,
//   h,
//   shallowRef,
// } from 'vue'
// import type {
//   OriginXInput,
//   OriginYInput,
// } from '../composables/properties/origin'
// import { useDomRect } from '../composables/useDomRect'
// import { useRootFrame } from '../composables/useRootFrame'
// import { useViewportRect } from '../composables/useViewportRect'
// import { frameSizingPropDefs } from '../internal/props'
// import type { FrameFit } from '../internal/types'
//
// const rootFramePropDefs = {
//   ...frameSizingPropDefs,
//   fit: { type: String as PropType<FrameFit>, default: 'contain' },
//   originX: { type: String as PropType<OriginXInput>, default: '50%' },
//   originY: { type: String as PropType<OriginYInput>, default: '50%' },
// } as const
//
// export const GraphicRoot = defineComponent({
//   name: 'RootFrame',
//   props: rootFramePropDefs,
//   slots: Object as SlotsType<{
//     default: Readonly<ReadonlyRect>
//   }>,
//   setup(props, { slots }) {
//     const svg = shallowRef<SVGElement>()
//
//     const domRect = useDomRect(svg)
//
//     const root = useRootFrame(domRect, props)
//
//     const viewportRect = useViewportRect(
//       domRect,
//       root,
//       () => props.fit ?? 'contain',
//       () => props.originX ?? '50%',
//       () => props.originY ?? '50%',
//     )
//     const viewBox = computed(
//       () =>
//         `${viewportRect.value.x} ${viewportRect.value.y} ${viewportRect.value.width} ${viewportRect.value.height}`,
//     )
//
//     return () => {
//       return h(
//         'svg',
//         {
//           ref: svg,
//           preserveAspectRatio: 'none',
//           viewBox: viewBox.value,
//         },
//         slots.default?.(root.value),
//       )
//     }
//   },
// })
