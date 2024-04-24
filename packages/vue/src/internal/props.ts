import type { FrameOptions } from 'placement'
import type { PropType } from 'vue'
import type { Numberish } from './types'

export const svgPaintPropDefs = {
  fill: { type: [String, Boolean] as PropType<string | true>, required: false },
  fillOpacity: {
    type: [Number, String] as PropType<Numberish>,
    required: false,
  },
  fillRule: {
    type: String as PropType<'nonzero' | 'evenodd' | 'inherit'>,
    required: false,
  },
  stroke: {
    type: [String, Boolean] as PropType<string | true>,
    required: false,
  },
  strokeWidth: {
    type: [Number, String] as PropType<Numberish>,
    required: false,
  },
  strokeLinecap: {
    type: String as PropType<'butt' | 'round' | 'square' | 'inherit'>,
    required: false,
  },
  strokeLinejoin: {
    type: String as PropType<'miter' | 'round' | 'bevel' | 'inherit'>,
    required: false,
  },
  strokeMiterlimit: {
    type: [Number, String] as PropType<Numberish>,
    required: false,
  },
  strokeDasharray: { type: String as PropType<string>, required: false },
  strokeDashoffset: {
    type: [Number, String] as PropType<Numberish>,
    required: false,
  },
  strokeOpacity: {
    type: [Number, String] as PropType<Numberish>,
    required: false,
  },
}

export const svgPaintPropKeys = new Set(
  Object.keys(svgPaintPropDefs) as ReadonlyArray<keyof typeof svgPaintPropDefs>,
)

export const frameSizingPropDefs = {
  width: {
    type: [Number, String] as PropType<FrameOptions['width']>,
    required: false,
  },
  height: {
    type: [Number, String] as PropType<FrameOptions['height']>,
    required: false,
  },
  aspectRatio: {
    type: [Number, String] as PropType<FrameOptions['aspectRatio']>,
    required: false,
  },
  minWidth: {
    type: [Number, String] as PropType<FrameOptions['minWidth']>,
    required: false,
  },
  minHeight: {
    type: [Number, String] as PropType<FrameOptions['minHeight']>,
    required: false,
  },
  maxWidth: {
    type: [Number, String] as PropType<FrameOptions['maxWidth']>,
    required: false,
  },
  maxHeight: {
    type: [Number, String] as PropType<FrameOptions['maxHeight']>,
    required: false,
  },
}

export const frameSelfPropDefs = {
  ...frameSizingPropDefs,
  offsetTop: {
    type: [Number, String] as PropType<FrameOptions['offsetTop']>,
    required: false,
  },
  offsetRight: {
    type: [Number, String] as PropType<FrameOptions['offsetRight']>,
    required: false,
  },
  offsetBottom: {
    type: [Number, String] as PropType<FrameOptions['offsetBottom']>,
    required: false,
  },
  offsetLeft: {
    type: [Number, String] as PropType<FrameOptions['offsetLeft']>,
    required: false,
  },
  offsetX: {
    type: [Number, String] as PropType<FrameOptions['offsetX']>,
    required: false,
  },
  offsetY: {
    type: [Number, String] as PropType<FrameOptions['offsetY']>,
    required: false,
  },
  offset: {
    type: [Number, String] as PropType<FrameOptions['offset']>,
    required: false,
  },
  translateX: {
    type: [Number, String] as PropType<FrameOptions['translateX']>,
    required: false,
  },
  translateY: {
    type: [Number, String] as PropType<FrameOptions['translateY']>,
    required: false,
  },
  translate: {
    type: [Number, String] as PropType<FrameOptions['translate']>,
    required: false,
  },
  grow: {
    type: [Number, String] as PropType<FrameOptions['grow']>,
    required: false,
  },
  shrink: {
    type: [Number, String] as PropType<FrameOptions['shrink']>,
    required: false,
  },
  alignSelf: {
    type: [Number, String] as PropType<FrameOptions['alignSelf']>,
    required: false,
  },
  stretchSelf: {
    type: [Number, String] as PropType<FrameOptions['stretchSelf']>,
    required: false,
  },
}

export const frameInsetProps = {
  insetTop: {
    type: [Number, String] as PropType<FrameOptions['insetTop']>,
    required: false,
  },
  insetRight: {
    type: [Number, String] as PropType<FrameOptions['insetRight']>,
    required: false,
  },
  insetBottom: {
    type: [Number, String] as PropType<FrameOptions['insetBottom']>,
    required: false,
  },
  insetLeft: {
    type: [Number, String] as PropType<FrameOptions['insetLeft']>,
    required: false,
  },
  insetX: {
    type: [Number, String] as PropType<FrameOptions['insetX']>,
    required: false,
  },
  insetY: {
    type: [Number, String] as PropType<FrameOptions['insetY']>,
    required: false,
  },
  inset: {
    type: [Number, String] as PropType<FrameOptions['inset']>,
    required: false,
  },
}

export const frameFlexProps = {
  flexDirection: {
    type: String as PropType<
      'row' | 'row-reverse' | 'column' | 'column-reverse'
    >,
    required: false,
  },
  flexWrap: {
    type: String as PropType<'nowrap' | 'wrap' | 'wrap-reverse'>,
    required: false,
  },
  gap: {
    type: [Number, String] as PropType<FrameOptions['gap']>,
    required: false,
  },
  rowGap: {
    type: [Number, String] as PropType<FrameOptions['rowGap']>,
    required: false,
  },
  columnGap: {
    type: [Number, String] as PropType<FrameOptions['columnGap']>,
    required: false,
  },
  placeContent: {
    type: [Number, String] as PropType<FrameOptions['placeContent']>,
    required: false,
  },
  justifyContent: {
    type: [Number, String] as PropType<FrameOptions['justifyContent']>,
    required: false,
  },
  alignContent: {
    type: [Number, String] as PropType<FrameOptions['alignContent']>,
    required: false,
  },
  alignItems: {
    type: [Number, String] as PropType<FrameOptions['alignItems']>,
    required: false,
  },
  justifyContentSpace: {
    type: [Number, String] as PropType<FrameOptions['justifyContentSpace']>,
    required: false,
  },
  alignContentSpace: {
    type: [Number, String] as PropType<FrameOptions['alignContentSpace']>,
    required: false,
  },
  placeContentSpace: {
    type: [Number, String] as PropType<FrameOptions['placeContentSpace']>,
    required: false,
  },
  justifyContentSpaceOuter: {
    type: [Number, String] as PropType<
      FrameOptions['justifyContentSpaceOuter']
    >,
    required: false,
  },
  alignContentSpaceOuter: {
    type: [Number, String] as PropType<FrameOptions['alignContentSpaceOuter']>,
    required: false,
  },
  placeContentSpaceOuter: {
    type: [Number, String] as PropType<FrameOptions['placeContentSpaceOuter']>,
    required: false,
  },
  stretchContent: {
    type: [Number, String] as PropType<FrameOptions['stretchContent']>,
    required: false,
  },
  stretchItems: {
    type: [Number, String] as PropType<FrameOptions['stretchItems']>,
    required: false,
  },
}
