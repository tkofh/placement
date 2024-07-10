export const direction = {
  row: 0,
  'row-reverse': 1,
  column: 2,
  'column-reverse': 3,
} as const

export const wrap = {
  nowrap: 0,
  wrap: 1,
  'wrap-reverse': 2,
} as const
type FlexDirection = (typeof direction)[keyof typeof direction]
type FlexWrap = (typeof wrap)[keyof typeof wrap]

interface FlexboxInput {
  readonly direction?: FlexDirection
  readonly wrap?: FlexWrap
  readonly alignContent?: number
  readonly alignItems?: number
  readonly stretchContent?: number
  readonly stretchItems?: number
  readonly justifyContent?: number
  readonly rowGap?: number
  readonly columnGap?: number
  readonly justifyContentSpace?: number
  readonly justifyContentSpaceOuter?: number
  readonly alignContentSpace?: number
  readonly alignContentSpaceOuter?: number
}

const TypeBrand: unique symbol = Symbol('placement/flexbox')
type TypeBrand = typeof TypeBrand

class Flexbox {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly direction: FlexDirection = direction.row
  readonly wrap: FlexWrap = wrap.nowrap
  readonly alignContent: number = 0
  readonly alignItems: number = 0
  readonly stretchContent: number = 0
  readonly stretchItems: number = 0
  readonly justifyContent: number = 0
  readonly rowGap: number = 0
  readonly columnGap: number = 0
  readonly justifyContentSpace: number = 0
  readonly justifyContentSpaceOuter: number = 0
  readonly alignContentSpace: number = 0
  readonly alignContentSpaceOuter: number = 0

  constructor(flexbox: FlexboxInput) {
    this.direction = flexbox.direction ?? this.direction
    this.wrap = flexbox.wrap ?? this.wrap

    this.justifyContent = flexbox.justifyContent ?? this.justifyContent
    this.alignContent = flexbox.alignContent ?? this.alignContent

    this.alignItems = flexbox.alignItems ?? this.alignItems

    this.stretchContent = flexbox.stretchContent ?? this.stretchContent
    this.stretchItems = flexbox.stretchItems ?? this.stretchItems

    this.rowGap = flexbox.rowGap ?? this.rowGap
    this.columnGap = flexbox.columnGap ?? this.columnGap

    this.justifyContentSpace =
      flexbox.justifyContentSpace ?? this.justifyContentSpace
    this.justifyContentSpaceOuter =
      flexbox.justifyContentSpaceOuter ?? this.justifyContentSpaceOuter
    this.alignContentSpace = flexbox.alignContentSpace ?? this.alignContentSpace
    this.alignContentSpaceOuter =
      flexbox.alignContentSpaceOuter ?? this.alignContentSpaceOuter
  }

  get isRow(): boolean {
    return this.direction <= 1
  }

  get mainGap(): number {
    return this.isRow ? this.rowGap : this.columnGap
  }

  get crossGap(): number {
    return this.isRow ? this.columnGap : this.rowGap
  }

  get mainDimension(): 'width' | 'height' {
    return this.isRow ? 'width' : 'height'
  }

  get crossDimension(): 'width' | 'height' {
    return this.isRow ? 'height' : 'width'
  }

  get mainDimensionMin(): 'minWidth' | 'minHeight' {
    return this.isRow ? 'minWidth' : 'minHeight'
  }

  get crossDimensionMin(): 'minWidth' | 'minHeight' {
    return this.isRow ? 'minHeight' : 'minWidth'
  }

  get mainDimensionMax(): 'maxWidth' | 'maxHeight' {
    return this.isRow ? 'maxWidth' : 'maxHeight'
  }

  get crossDimensionMax(): 'maxWidth' | 'maxHeight' {
    return this.isRow ? 'maxHeight' : 'maxWidth'
  }

  get mainCoordinate(): 'x' | 'y' {
    return this.isRow ? 'x' : 'y'
  }

  get crossCoordinate(): 'x' | 'y' {
    return this.isRow ? 'y' : 'x'
  }

  get crossOffsetStart(): 'offsetTop' | 'offsetLeft' {
    return this.isRow ? 'offsetTop' : 'offsetLeft'
  }

  get crossOffsetEnd(): 'offsetBottom' | 'offsetRight' {
    return this.isRow ? 'offsetBottom' : 'offsetRight'
  }

  get mainOffsetStart(): 'offsetTop' | 'offsetLeft' {
    return this.isRow ? 'offsetLeft' : 'offsetTop'
  }

  get mainOffsetEnd(): 'offsetBottom' | 'offsetRight' {
    return this.isRow ? 'offsetRight' : 'offsetBottom'
  }
}

export type { Flexbox }

export function flexbox(flexbox: FlexboxInput): Flexbox {
  return new Flexbox(flexbox)
}

export function isFlexbox(value: unknown): value is Flexbox {
  return typeof value === 'object' && value !== null && TypeBrand in value
}
