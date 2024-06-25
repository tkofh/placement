// import { parse } from 'valued'
// import { oneOf, someOf } from 'valued/combinators'
// import { keyword } from 'valued/data/keyword'
// import { type Frame, frame } from './frame'
// import { type Rect, rect } from './rect'
// import { type Span, span } from './span'
// import { dual } from './utils/function'
// import { clamp } from './utils/math'
//
// const direction = oneOf([
//   keyword('row'),
//   keyword('column'),
//   keyword('row-reverse'),
//   keyword('column-reverse'),
// ])
//
// const wrap = oneOf([
//   keyword('nowrap'),
//   keyword('wrap'),
//   keyword('wrap-reverse'),
// ])
//
// const flow = someOf([direction, wrap])
//
// function parseFlow(input: string): [FlexDirection | null, FlexWrap | null] {
//   const result = parse(input, flow)
//   if (!result.valid) {
//     return [null, null]
//   }
//
//   return [result.value[0]?.value ?? null, result.value[1]?.value ?? null]
// }
//
// type Mutable<T> = T extends object
//   ? { -readonly [K in keyof T]: Mutable<T[K]> }
//   : T
//
// type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
// type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
//
// type FlexFlow =
//   | FlexDirection
//   | FlexWrap
//   | `${FlexDirection} ${FlexWrap}`
//   | `${FlexWrap} ${FlexDirection}`
//
// interface Flexbox {
//   readonly flow?: FlexFlow
//   readonly direction?: FlexDirection
//   readonly wrap?: FlexWrap
//   readonly placeContent?: number
//   readonly alignContent?: number
//   readonly alignItems?: number
//   readonly stretchContent?: number
//   readonly stretchItems?: number
//   readonly justifyContent?: number
//   readonly gap?: number
//   readonly rowGap?: number
//   readonly columnGap?: number
//   readonly placeContentSpace?: number
//   readonly placeContentSpaceOuter?: number
//   readonly justifyContentSpace?: number
//   readonly justifyContentSpaceOuter?: number
//   readonly alignContentSpace?: number
//   readonly alignContentSpaceOuter?: number
// }
//
// class NormalizedFlexbox {
//   readonly direction: FlexDirection = 'row'
//   readonly wrap: FlexWrap = 'nowrap'
//   readonly alignContent: number = 0
//   readonly alignItems: number = 0
//   readonly stretchContent: number = 0
//   readonly stretchItems: number = 0
//   readonly justifyContent: number = 0
//   readonly rowGap: number = 0
//   readonly columnGap: number = 0
//   readonly justifyContentSpace: number = 0
//   readonly justifyContentSpaceOuter: number = 0
//   readonly alignContentSpace: number = 0
//   readonly alignContentSpaceOuter: number = 0
//
//   constructor(flexbox: Flexbox) {
//     if (typeof flexbox.flow === 'string') {
//       const [direction, wrap] = parseFlow(flexbox.flow)
//
//       if (direction !== null) {
//         this.direction = direction
//       }
//
//       if (wrap !== null) {
//         this.wrap = wrap
//       }
//     } else {
//       this.direction = flexbox.direction ?? this.direction
//       this.wrap = flexbox.wrap ?? this.wrap
//     }
//
//     this.justifyContent =
//       flexbox.justifyContent ?? flexbox.placeContent ?? this.justifyContent
//     this.alignContent =
//       flexbox.alignContent ?? flexbox.placeContent ?? this.alignContent
//
//     this.alignItems = flexbox.alignItems ?? this.alignItems
//
//     this.stretchContent = flexbox.stretchContent ?? this.stretchContent
//     this.stretchItems = flexbox.stretchItems ?? this.stretchItems
//
//     this.rowGap = flexbox.rowGap ?? flexbox.gap ?? this.rowGap
//     this.columnGap = flexbox.columnGap ?? flexbox.gap ?? this.columnGap
//
//     this.justifyContentSpace =
//       flexbox.justifyContentSpace ??
//       flexbox.placeContentSpace ??
//       this.justifyContentSpace
//     this.justifyContentSpaceOuter =
//       flexbox.justifyContentSpaceOuter ??
//       flexbox.placeContentSpaceOuter ??
//       this.justifyContentSpaceOuter
//     this.alignContentSpace =
//       flexbox.alignContentSpace ??
//       flexbox.placeContentSpace ??
//       this.alignContentSpace
//     this.alignContentSpaceOuter =
//       flexbox.alignContentSpaceOuter ??
//       flexbox.placeContentSpaceOuter ??
//       this.alignContentSpaceOuter
//   }
//
//   get isRow(): boolean {
//     return this.direction === 'row' || this.direction === 'row-reverse'
//   }
//
//   get mainGap(): number {
//     return this.isRow ? this.rowGap : this.columnGap
//   }
//
//   get crossGap(): number {
//     return this.isRow ? this.columnGap : this.rowGap
//   }
// }
//
// interface FlexItem {
//   readonly definiteMainOffsetStart: number
//   readonly definiteCrossOffsetStart: number
//   readonly definiteMainOffset: number
//   readonly definiteCrossOffset: number
//
//   readonly offsetAutoMainStart: number
//   readonly offsetAutoMainEnd: number
//   readonly offsetAutoCrossStart: number
//   readonly offsetAutoCrossEnd: number
//
//   readonly outerHypotheticalMainSize: number
//   readonly outerHypotheticalCrossSize: number
//
//   readonly outerMaxMainSize: number
//   readonly outerMinMainSize: number
//
//   readonly scaledShrinkFactor: number
//   readonly availableShrinkage: number
//
//   readonly growthFactor: number
//   readonly availableGrowth: number
// }
//
// interface LogicalOffsets {
//   readonly mainStart: number
//   readonly mainEnd: number
//   readonly crossStart: number
//   readonly crossEnd: number
// }
//
// interface FlexLine {
//   readonly mainSize: number
//   readonly crossSize: number
//   readonly growth: number
//   readonly scaledShrink: number
//   readonly autoOffset: number
//   readonly items: ReadonlyArray<FlexItem>
// }
//
// function logicalOffsets(
//   direction: FlexDirection,
//   frame: Frame,
// ): LogicalOffsets {
//   switch (direction) {
//     case 'row':
//       return {
//         mainStart: frame.offsetLeft,
//         mainEnd: frame.offsetRight,
//         crossStart: frame.offsetTop,
//         crossEnd: frame.offsetBottom,
//       }
//
//     case 'column':
//       return {
//         mainStart: frame.offsetTop,
//         mainEnd: frame.offsetBottom,
//         crossStart: frame.offsetLeft,
//         crossEnd: frame.offsetRight,
//       }
//
//     case 'row-reverse':
//       return {
//         mainStart: frame.offsetRight,
//         mainEnd: frame.offsetLeft,
//         crossStart: frame.offsetTop,
//         crossEnd: frame.offsetBottom,
//       }
//
//     case 'column-reverse':
//       return {
//         mainStart: frame.offsetBottom,
//         mainEnd: frame.offsetTop,
//         crossStart: frame.offsetLeft,
//         crossEnd: frame.offsetRight,
//       }
//   }
// }
//
// // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this function is complex by design
// function* toFlexItems(
//   _flexbox: NormalizedFlexbox,
//   frames: ReadonlyArray<Frame>,
// ): Generator<Span, Span> {
//   for (const frame of frames) {
//     const offsets = logicalOffsets(direction, frame)
//
//     const definiteMainOffsetStart =
//       offsets.mainStart === Number.POSITIVE_INFINITY ? 0 : offsets.mainStart
//     const definiteMainOffsetEnd =
//       offsets.mainEnd === Number.POSITIVE_INFINITY ? 0 : offsets.mainEnd
//     const definiteMainOffset = definiteMainOffsetStart + definiteMainOffsetEnd
//
//     const definiteCrossOffsetStart =
//       offsets.crossStart === Number.POSITIVE_INFINITY ? 0 : offsets.crossStart
//     const definiteCrossOffsetEnd =
//       offsets.crossEnd === Number.POSITIVE_INFINITY ? 0 : offsets.crossEnd
//     const definiteCrossOffset =
//       definiteCrossOffsetStart + definiteCrossOffsetEnd
//
//     const constrainedWidth = clamp(frame.width, frame.minWidth, frame.maxWidth)
//     const constrainedHeight = clamp(
//       frame.height,
//       frame.minHeight,
//       frame.maxHeight,
//     )
//
//     const outerHypotheticalMainSize =
//       definiteMainOffset + (isRow ? constrainedWidth : constrainedHeight)
//
//     const outerMaxMainSize =
//       definiteMainOffset + (isRow ? frame.maxWidth : frame.maxHeight)
//     const outerMinMainSize =
//       definiteMainOffset + (isRow ? frame.minWidth : frame.minHeight)
//
//     yield {
//       definiteMainOffsetStart,
//       definiteMainOffset,
//       definiteCrossOffsetStart,
//       definiteCrossOffset,
//
//       offsetAutoMainStart:
//         offsets.mainStart === Number.POSITIVE_INFINITY ? 1 : 0,
//       offsetAutoMainEnd: offsets.mainEnd === Number.POSITIVE_INFINITY ? 1 : 0,
//       offsetAutoCrossStart:
//         offsets.crossStart === Number.POSITIVE_INFINITY ? 1 : 0,
//       offsetAutoCrossEnd: offsets.crossEnd === Number.POSITIVE_INFINITY ? 1 : 0,
//
//       outerHypotheticalMainSize,
//       outerHypotheticalCrossSize:
//         definiteCrossOffset + (isRow ? constrainedHeight : constrainedWidth),
//
//       outerMaxMainSize,
//       outerMinMainSize,
//
//       scaledShrinkFactor: frame.shrink * (isRow ? frame.width : frame.height),
//       availableShrinkage: outerHypotheticalMainSize - outerMinMainSize,
//       growthFactor: frame.grow,
//       availableGrowth: outerMaxMainSize - outerHypotheticalMainSize,
//     }
//   }
// }
//
// function* flexLines(
//   frames: ReadonlyArray<Frame>,
//   flexbox: NormalizedFlexbox,
//   rect: Rect,
// ): IterableIterator<FlexLine> {
//   const isRow =
//     flexbox.direction === 'row' || flexbox.direction === 'row-reverse'
//
//   const rowGap = flexbox.rowGap
//   const columnGap = flexbox.columnGap
//
//   const mainGap = isRow ? rowGap : columnGap
//
//   const layoutMainSize = isRow ? rect.width : rect.height
//
//   let mainSize = 0
//   let crossSize = 0
//   let growth = 0
//   let scaledShrink = 0
//   let autoOffset = 0
//   let items: Array<FlexItem> = []
//
//   const stream = toFlexItems(flexbox.direction, frames)
//   while (true) {
//     const current = stream.next()
//
//     if (current.done) {
//       yield { mainSize, crossSize, growth, scaledShrink, autoOffset, items }
//       break
//     }
//
//     const item = current.value
//
//     if (
//       flexbox.wrap !== 'nowrap' &&
//       items.length > 0 &&
//       mainSize + item.outerHypotheticalMainSize > layoutMainSize
//     ) {
//       mainSize -= mainGap
//       yield { mainSize, crossSize, growth, scaledShrink, autoOffset, items }
//       mainSize = 0
//       crossSize = 0
//       growth = 0
//       scaledShrink = 0
//       autoOffset = 0
//       items = []
//     }
//
//     items.push(item)
//
//     mainSize += item.outerHypotheticalMainSize + mainGap
//     crossSize = Math.max(crossSize, item.outerHypotheticalCrossSize)
//
//     growth += item.growthFactor
//     scaledShrink += item.scaledShrinkFactor
//
//     autoOffset += item.offsetAutoMainStart + item.offsetAutoMainEnd
//   }
// }
//
// const _alignItem: {
//   (item: Span, line: Span, align: number, stretch: number): Span
//   (line: Span, align: number, stretch: number): (item: Span) => Span
// } = dual(4, (item: Span, line: Span, align: number, stretch: number): Span => {
//   const rawDelta = line.size - item.size
//   const size = rawDelta * stretch + item.size
//
//   const scaledDelta = line.size - size
//
//   return span(line.start + align * scaledDelta, size)
// })
//
// export const flexbox: {
//   (
//     rect: Rect,
//     flexbox: Flexbox,
//   ): (frames: ReadonlyArray<Frame>) => ReadonlyArray<Rect>
//   (
//     frames: ReadonlyArray<Frame>,
//     flexbox: Flexbox,
//     rect: Rect,
//   ): ReadonlyArray<Rect>
// } = dual(
//   3,
//   (
//     frames: ReadonlyArray<Frame>,
//     flexbox: Flexbox,
//     rect: Rect,
//   ): ReadonlyArray<Rect> => {
//     const normalized = new NormalizedFlexbox(flexbox)
//
//     const isRow =
//       normalized.direction === 'row' || normalized.direction === 'row-reverse'
//     const crossGap = isRow ? normalized.columnGap : normalized.rowGap
//
//     let totalCrossSize = 0
//     const lines: Array<FlexLine> = []
//
//     for (const line of flexLines(frames, normalized, rect)) {
//       lines.push(line)
//       totalCrossSize += line.crossSize + normalized.rowGap
//     }
//     totalCrossSize -= crossGap
//
//     const _stretchContent = lines.length === 1 ? 1 : normalized.stretchContent
//
//     const _alignContent = lines.length === 1 ? 0 : normalized.alignContent
//
//     console.log({ totalCrossSize })
//
//     console.log(JSON.stringify(lines, null, 2))
//
//     return []
//   },
// )
//
// const result = flexbox(
//   [
//     frame({ width: 100, height: 100 }),
//     frame({ width: 100, height: 100 }),
//     frame({ width: 100, height: 100 }),
//   ],
//   {
//     flow: 'row wrap',
//     gap: 10,
//   },
//   rect(200),
// )
//
// console.log(result)
