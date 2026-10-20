import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Alignment from '../src/alignment.ts'
import * as Frame from '../src/frame.ts'

const base = Adornment.make({ width: 9, height: 8 })

describe('adornment', () => {
  test('make applies the defaults', () => {
    expect(base.toJSON()).toEqual({
      width: 9,
      height: 8,
      aspectRatio: undefined,
      minWidth: undefined,
      minHeight: undefined,
      maxWidth: undefined,
      maxHeight: undefined,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      align: Alignment.inherit,
      at: 0.5,
      position: Adornment.position.flow,
      layer: 0,
      orient: Adornment.orient.upright,
    })
  })

  test('encodings', () => {
    expect(Adornment.position).toEqual({ flow: 0, absolute: 1 })
    expect(Adornment.orient).toEqual({ upright: 0, forward: 1, backward: 2 })
  })

  test('isAdornment accepts adornments and rejects everything else', () => {
    expect(Adornment.isAdornment(base)).toBe(true)
    expect(Adornment.isAdornment({ width: 9, at: 0.5 })).toBe(false)
    expect(Adornment.isAdornment(Frame.make({ width: 9 }))).toBe(false)
    expect(Adornment.isAdornment(null)).toBe(false)
  })

  test('a JSON round trip of the fields rebuilds the adornment', () => {
    const arrow = Adornment.make({ width: 9, at: 1, layer: 2, orient: Adornment.orient.forward })
    expect(Adornment.make(JSON.parse(JSON.stringify(arrow))).toJSON()).toEqual(
      Adornment.make(arrow.toJSON()).toJSON(),
    )
  })

  test('the size resolves as a frame does', () => {
    const input = { width: 12, aspectRatio: 2, maxHeight: 4, minWidth: 20 }
    const adornment = Adornment.make(input)
    const frame = Frame.make(input)
    expect([adornment.width, adornment.height]).toEqual([frame.width, frame.height])
    expect([
      adornment.minWidth,
      adornment.maxWidth,
      adornment.minHeight,
      adornment.maxHeight,
    ]).toEqual([frame.minWidth, frame.maxWidth, frame.minHeight, frame.maxHeight])
  })

  test('it takes no flex factors or stretch', () => {
    // @ts-expect-error -- adornments never grow, shrink, or stretch
    const adornment = Adornment.make({ width: 9, grow: 1, stretch: 1 })
    expect(adornment.toJSON()).not.toHaveProperty('grow')
    expect(adornment.toJSON()).not.toHaveProperty('stretch')
  })

  test.each([
    ['setAt', Adornment.setAt(base, 1), base.pipe(Adornment.setAt(1)), 'at', 1],
    [
      'setPosition',
      Adornment.setPosition(base, Adornment.position.absolute),
      base.pipe(Adornment.setPosition(Adornment.position.absolute)),
      'position',
      1,
    ],
    ['setLayer', Adornment.setLayer(base, 3), base.pipe(Adornment.setLayer(3)), 'layer', 3],
    [
      'setOrient',
      Adornment.setOrient(base, Adornment.orient.backward),
      base.pipe(Adornment.setOrient(Adornment.orient.backward)),
      'orient',
      2,
    ],
    ['setAlign', Adornment.setAlign(base, 1), base.pipe(Adornment.setAlign(1)), 'align', 1],
    ['setWidth', Adornment.setWidth(base, 3), base.pipe(Adornment.setWidth(3)), 'width', 3],
    ['setHeight', Adornment.setHeight(base, 3), base.pipe(Adornment.setHeight(3)), 'height', 3],
    [
      'setMinWidth',
      Adornment.setMinWidth(base, 20),
      base.pipe(Adornment.setMinWidth(20)),
      'width',
      20,
    ],
    [
      'setMinHeight',
      Adornment.setMinHeight(base, 20),
      base.pipe(Adornment.setMinHeight(20)),
      'height',
      20,
    ],
    [
      'setMaxWidth',
      Adornment.setMaxWidth(base, 2),
      base.pipe(Adornment.setMaxWidth(2)),
      'width',
      2,
    ],
    [
      'setMaxHeight',
      Adornment.setMaxHeight(base, 2),
      base.pipe(Adornment.setMaxHeight(2)),
      'height',
      2,
    ],
    [
      'setMarginTop',
      Adornment.setMarginTop(base, 2),
      base.pipe(Adornment.setMarginTop(2)),
      'marginTop',
      2,
    ],
    [
      'setMarginRight',
      Adornment.setMarginRight(base, 2),
      base.pipe(Adornment.setMarginRight(2)),
      'marginRight',
      2,
    ],
    [
      'setMarginBottom',
      Adornment.setMarginBottom(base, 2),
      base.pipe(Adornment.setMarginBottom(2)),
      'marginBottom',
      2,
    ],
    [
      'setMarginLeft',
      Adornment.setMarginLeft(base, 2),
      base.pipe(Adornment.setMarginLeft(2)),
      'marginLeft',
      2,
    ],
  ] as const)('%s works in both forms', (_, dataFirst, dataLast, field, value) => {
    expect(dataFirst[field]).toBe(value)
    expect(dataLast[field]).toBe(value)
    expect(base[field]).not.toBe(value)
  })

  test('the two-value setters work in both forms', () => {
    const sized = (a: Adornment.Adornment) => [a.width, a.height]
    expect(sized(Adornment.setSize(base, 3, 4))).toEqual([3, 4])
    expect(sized(base.pipe(Adornment.setSize(5)))).toEqual([5, 5])
    expect(sized(Adornment.setMinSize(base, 20, 30))).toEqual([20, 30])
    expect(sized(base.pipe(Adornment.setMinSize(20)))).toEqual([20, 20])
    expect(sized(Adornment.setMaxSize(base, 2, 3))).toEqual([2, 3])
    expect(sized(base.pipe(Adornment.setMaxSize(2)))).toEqual([2, 2])
    expect(Adornment.setAspectRatio(Adornment.make({ width: 12 }), 2).height).toBe(6)
    expect(Adornment.make({ height: 6 }).pipe(Adornment.setAspectRatio([4, 3])).width).toBe(8)
  })

  test('the margin shorthands work in both forms', () => {
    const margins = (a: Adornment.Adornment) => [
      a.marginTop,
      a.marginRight,
      a.marginBottom,
      a.marginLeft,
    ]
    expect(margins(Adornment.setMargin(base, 1, 2))).toEqual([1, 2, 1, 2])
    expect(margins(base.pipe(Adornment.setMargin(1, 2, 3, 4)))).toEqual([1, 2, 3, 4])
    expect(margins(base.pipe(Adornment.setMargin(1, 2, 3)))).toEqual([1, 2, 3, 2])
    expect(margins(Adornment.setMarginX(base, 5))).toEqual([0, 5, 0, 5])
    expect(margins(base.pipe(Adornment.setMarginX(5, 6)))).toEqual([0, 6, 0, 5])
    expect(margins(Adornment.setMarginY(base, 5, 6))).toEqual([5, 0, 6, 0])
    expect(margins(base.pipe(Adornment.setMarginY(5)))).toEqual([5, 0, 5, 0])
  })

  test('setters keep the other fields', () => {
    const arrow = Adornment.make({ width: 9, at: 1, orient: Adornment.orient.forward, layer: 1 })
    expect(Adornment.setAt(arrow, 0).toJSON()).toEqual({ ...arrow.toJSON(), at: 0 })
    expect(Adornment.setWidth(Adornment.make({ width: 4, aspectRatio: 2 }), 8).height).toBe(4)
  })
})
