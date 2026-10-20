import { describe, expect, test } from 'vitest'
import type * as AspectRatio from '../src/aspectRatio.ts'
import * as Flexbox from '../src/flexbox.ts'
import * as Frame from '../src/frame.ts'
import * as Rect from '../src/rect.ts'

describe('frame', () => {
  test('empty input applies the defaults', () => {
    const result = Frame.make({})
    expect(result.marginTop).toBe(0)
    expect(result.marginRight).toBe(0)
    expect(result.marginBottom).toBe(0)
    expect(result.marginLeft).toBe(0)
    expect(result.width).toBe(0)
    expect(result.height).toBe(0)
    expect(result.aspectRatio).toBeNaN()
    expect(result.minWidth).toBe(0)
    expect(result.minHeight).toBe(0)
    expect(result.maxWidth).toBe(Number.POSITIVE_INFINITY)
    expect(result.maxHeight).toBe(Number.POSITIVE_INFINITY)
    expect(result.grow).toBe(0)
    expect(result.shrink).toBe(0)
    expect(result.align).toBe(Number.POSITIVE_INFINITY)
    expect(result.stretch).toBe(Number.POSITIVE_INFINITY)
  })

  test('definite width and height win', () => {
    const result = Frame.make({ width: 100, height: 50 })
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
    expect(result.aspectRatio).toBe(2)
  })

  test('aspect ratio derives the missing dimension', () => {
    expect(Frame.make({ width: 100, aspectRatio: 2 }).height).toBe(50)
    expect(Frame.make({ height: 50, aspectRatio: 2 }).width).toBe(100)
  })

  test('aspect ratio alone applies against the clamped fallbacks', () => {
    const fromHeight = Frame.make({ aspectRatio: 2, minHeight: 100 })
    expect(fromHeight.width).toBe(200)
    expect(fromHeight.height).toBe(100)

    const fromWidth = Frame.make({ aspectRatio: 2, minWidth: 100 })
    expect(fromWidth.width).toBe(100)
    expect(fromWidth.height).toBe(50)
  })

  test('min and max constraints clamp the resolved size', () => {
    expect(Frame.make({ width: 100, maxWidth: 80 }).width).toBe(80)
    expect(Frame.make({ width: 100, minWidth: 150 }).width).toBe(150)
    expect(Frame.make({ height: 100, maxHeight: 80 }).height).toBe(80)
  })

  test('the minimum wins over a crossed maximum', () => {
    const crossed = Frame.make({ width: 120, minWidth: 100, maxWidth: 50 })
    expect(crossed.width).toBe(100)
    expect(crossed.maxWidth).toBe(100)
    expect(Frame.make({ height: 120, minHeight: 100, maxHeight: 50 }).height).toBe(100)
  })

  test('resolved aspect ratio is exact IEEE division', () => {
    expect(Frame.make({ width: 0.1, height: 0.2 }).aspectRatio).toBe(0.1 / 0.2)
  })
})

describe('guards', () => {
  test('isFrame', () => {
    expect(Frame.isFrame(Frame.make({}))).toBe(true)
    expect(Frame.isFrame({ width: 100 })).toBe(false)
    expect(Frame.isFrame(null)).toBe(false)
  })
})

describe('sizing resolves lazily from raw inputs', () => {
  test('unset height re-derives after setWidth (regression: sentinel destruction)', () => {
    const start = Frame.make({ width: 100, aspectRatio: 2 })
    expect(start.height).toBe(50)
    expect(Frame.setWidth(start, 200).height).toBe(100)
  })

  test('unset width re-derives after setHeight', () => {
    const start = Frame.make({ height: 50, aspectRatio: 2 })
    expect(start.width).toBe(100)
    expect(Frame.setHeight(start, 100).width).toBe(200)
  })

  test('unset aspect ratio stays unset through setters', () => {
    const result = Frame.setWidth(Frame.make({ width: 100, height: 50 }), 200)
    expect(result.height).toBe(50)
    expect(result.aspectRatio).toBe(4)
  })

  test('raw width survives clamping: raising the max un-clamps', () => {
    const start = Frame.make({ width: 100, maxWidth: 80 })
    expect(start.width).toBe(80)
    expect(Frame.setMaxWidth(start, 200).width).toBe(100)
  })

  test('constraints keep applying to values set later', () => {
    expect(Frame.setWidth(Frame.make({ maxWidth: 150 }), 200).width).toBe(150)
  })

  test('setters chain without leaking resolved values', () => {
    const result = Frame.make({ aspectRatio: 2 }).pipe(Frame.setWidth(100), Frame.setMinHeight(60))
    expect(result.width).toBe(100)
    expect(result.height).toBe(60)
  })
})

describe('setMargin', () => {
  test('one value sets all four margins', () => {
    const result = Frame.setMargin(Frame.make({}), 10)
    expect(result.marginTop).toBe(10)
    expect(result.marginRight).toBe(10)
    expect(result.marginBottom).toBe(10)
    expect(result.marginLeft).toBe(10)
  })

  test('two values are y and x', () => {
    const result = Frame.setMargin(Frame.make({}), 10, 20)
    expect(result.marginTop).toBe(10)
    expect(result.marginRight).toBe(20)
    expect(result.marginBottom).toBe(10)
    expect(result.marginLeft).toBe(20)
  })

  test('four values are top, right, bottom, left', () => {
    const result = Frame.setMargin(Frame.make({}), 1, 2, 3, 4)
    expect(result.marginTop).toBe(1)
    expect(result.marginRight).toBe(2)
    expect(result.marginBottom).toBe(3)
    expect(result.marginLeft).toBe(4)
  })

  test('data-last forms (regression: multi-arg calls used to dispatch data-first)', () => {
    expect(Frame.make({}).pipe(Frame.setMargin(10)).marginTop).toBe(10)

    const yx = Frame.make({}).pipe(Frame.setMargin(10, 20))
    expect(Frame.isFrame(yx)).toBe(true)
    expect(yx.marginTop).toBe(10)
    expect(yx.marginLeft).toBe(20)

    const trbl = Frame.make({}).pipe(Frame.setMargin(1, 2, 3, 4))
    expect(trbl.marginTop).toBe(1)
    expect(trbl.marginRight).toBe(2)
    expect(trbl.marginBottom).toBe(3)
    expect(trbl.marginLeft).toBe(4)
  })
})

describe('setMarginX', () => {
  test('one value sets both horizontal margins', () => {
    const result = Frame.setMarginX(Frame.make({}), 10)
    expect(result.marginLeft).toBe(10)
    expect(result.marginRight).toBe(10)
  })

  test('two values are left and right', () => {
    const result = Frame.setMarginX(Frame.make({}), 10, 20)
    expect(result.marginLeft).toBe(10)
    expect(result.marginRight).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(Frame.make({}).pipe(Frame.setMarginX(10)).marginRight).toBe(10)

    const result = Frame.make({}).pipe(Frame.setMarginX(10, 20))
    expect(result.marginLeft).toBe(10)
    expect(result.marginRight).toBe(20)
  })
})

describe('setMarginY', () => {
  test('one value sets both vertical margins', () => {
    const result = Frame.setMarginY(Frame.make({}), 10)
    expect(result.marginTop).toBe(10)
    expect(result.marginBottom).toBe(10)
  })

  test('two values are top and bottom', () => {
    const result = Frame.setMarginY(Frame.make({}), 10, 20)
    expect(result.marginTop).toBe(10)
    expect(result.marginBottom).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(Frame.make({}).pipe(Frame.setMarginY(10)).marginBottom).toBe(10)

    const result = Frame.make({}).pipe(Frame.setMarginY(10, 20))
    expect(result.marginTop).toBe(10)
    expect(result.marginBottom).toBe(20)
  })
})

describe('single-edge margins', () => {
  test('setMarginTop', () => {
    expect(Frame.setMarginTop(Frame.make({}), 5).marginTop).toBe(5)
    expect(Frame.make({}).pipe(Frame.setMarginTop(5)).marginTop).toBe(5)
  })

  test('setMarginRight', () => {
    expect(Frame.setMarginRight(Frame.make({}), 5).marginRight).toBe(5)
    expect(Frame.make({}).pipe(Frame.setMarginRight(5)).marginRight).toBe(5)
  })

  test('setMarginBottom', () => {
    expect(Frame.setMarginBottom(Frame.make({}), 5).marginBottom).toBe(5)
    expect(Frame.make({}).pipe(Frame.setMarginBottom(5)).marginBottom).toBe(5)
  })

  test('setMarginLeft', () => {
    expect(Frame.setMarginLeft(Frame.make({}), 5).marginLeft).toBe(5)
    expect(Frame.make({}).pipe(Frame.setMarginLeft(5)).marginLeft).toBe(5)
  })

  test('an edge setter leaves the other edges alone', () => {
    const result = Frame.setMarginTop(Frame.make({ marginLeft: 1 }), 5)
    expect(result.marginLeft).toBe(1)
    expect(result.marginBottom).toBe(0)
  })
})

describe('setSize', () => {
  test('width comes first (regression: argument order flipped from height-first)', () => {
    const result = Frame.setSize(Frame.make({}), 100, 50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both dimensions', () => {
    const result = Frame.setSize(Frame.make({}), 100)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  test('data-last forms (regression: two-arg call used to dispatch data-first)', () => {
    const result = Frame.make({}).pipe(Frame.setSize(100, 50))
    expect(Frame.isFrame(result)).toBe(true)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
    expect(Frame.make({}).pipe(Frame.setSize(100)).height).toBe(100)
  })
})

describe('setWidth and setHeight', () => {
  test('setWidth', () => {
    expect(Frame.setWidth(Frame.make({}), 100).width).toBe(100)
    expect(Frame.make({}).pipe(Frame.setWidth(100)).width).toBe(100)
  })

  test('setHeight', () => {
    expect(Frame.setHeight(Frame.make({}), 50).height).toBe(50)
    expect(Frame.make({}).pipe(Frame.setHeight(50)).height).toBe(50)
  })
})

describe('setAspectRatio', () => {
  test('derives the unset dimension', () => {
    expect(Frame.setAspectRatio(Frame.make({ width: 100 }), 4).height).toBe(25)
  })

  test('data-last form', () => {
    expect(Frame.make({ height: 25 }).pipe(Frame.setAspectRatio(4)).width).toBe(100)
  })
})

describe('setMinSize', () => {
  test('width comes first', () => {
    const result = Frame.setMinSize(Frame.make({}), 100, 50)
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both minimums', () => {
    const result = Frame.setMinSize(Frame.make({}), 100)
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(100)
  })

  test('data-last forms (regression)', () => {
    const result = Frame.make({}).pipe(Frame.setMinSize(100, 50))
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(50)
    expect(Frame.make({}).pipe(Frame.setMinSize(100)).minHeight).toBe(100)
  })
})

describe('setMinWidth and setMinHeight', () => {
  test('setMinWidth', () => {
    expect(Frame.setMinWidth(Frame.make({}), 100).minWidth).toBe(100)
    expect(Frame.make({}).pipe(Frame.setMinWidth(100)).minWidth).toBe(100)
  })

  test('setMinHeight', () => {
    expect(Frame.setMinHeight(Frame.make({}), 50).minHeight).toBe(50)
    expect(Frame.make({}).pipe(Frame.setMinHeight(50)).minHeight).toBe(50)
  })
})

describe('setMaxSize', () => {
  test('width comes first', () => {
    const result = Frame.setMaxSize(Frame.make({ width: 500, height: 400 }), 100, 50)
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both maximums', () => {
    const result = Frame.setMaxSize(Frame.make({}), 100)
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(100)
  })

  test('data-last forms (regression)', () => {
    const result = Frame.make({}).pipe(Frame.setMaxSize(100, 50))
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(50)
    expect(Frame.make({}).pipe(Frame.setMaxSize(100)).maxHeight).toBe(100)
  })
})

describe('setMaxWidth and setMaxHeight', () => {
  test('setMaxWidth', () => {
    expect(Frame.setMaxWidth(Frame.make({}), 100).maxWidth).toBe(100)
    expect(Frame.make({}).pipe(Frame.setMaxWidth(100)).maxWidth).toBe(100)
  })

  test('setMaxHeight', () => {
    expect(Frame.setMaxHeight(Frame.make({}), 50).maxHeight).toBe(50)
    expect(Frame.make({}).pipe(Frame.setMaxHeight(50)).maxHeight).toBe(50)
  })
})

describe('flex and placement setters', () => {
  test('setGrow', () => {
    expect(Frame.setGrow(Frame.make({}), 1).grow).toBe(1)
    expect(Frame.make({}).pipe(Frame.setGrow(1)).grow).toBe(1)
  })

  test('setShrink', () => {
    expect(Frame.setShrink(Frame.make({}), 1).shrink).toBe(1)
    expect(Frame.make({}).pipe(Frame.setShrink(1)).shrink).toBe(1)
  })

  test('setAlign', () => {
    expect(Frame.setAlign(Frame.make({}), 0.5).align).toBe(0.5)
    expect(Frame.make({}).pipe(Frame.setAlign(0.5)).align).toBe(0.5)
  })

  test('setStretch', () => {
    expect(Frame.setStretch(Frame.make({}), 1).stretch).toBe(1)
    expect(Frame.make({}).pipe(Frame.setStretch(1)).stretch).toBe(1)
  })
})

describe('serialization', () => {
  test('toJSON emits raw inputs; unset sizing keys are absent', () => {
    expect(JSON.parse(JSON.stringify(Frame.make({ width: 100, marginTop: 5 })))).toEqual({
      marginTop: 5,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      width: 100,
      grow: 0,
      shrink: 0,
      // Infinity (inherit) has no JSON encoding, so it serializes as null.
      align: null,
      stretch: null,
    })
  })
})

describe('frame through a Proxy', () => {
  // Vue's `ref`/`reactive` wrap values in proxies, which `#private` fields reject.
  test('getters, toJSON, and setters read through the proxy', () => {
    const frame = new Proxy(Frame.make({ width: 100, aspectRatio: 2 }), {})
    expect(frame.height).toBe(50)
    expect(frame.toJSON()).toMatchObject({ width: 100, height: undefined, aspectRatio: 2 })
    expect(Frame.setWidth(frame, 40).height).toBe(20)
  })

  test('a frame has no identity', () => {
    // @ts-expect-error -- layouts key frames by id, so a frame takes none
    const frame = Frame.make({ id: 'a', width: 10 })
    expect(frame.toJSON()).not.toHaveProperty('id')
    expect('id' in frame).toBe(false)
  })
})

describe('aspect ratio pairs', () => {
  const r169: AspectRatio.AspectRatio = [16, 9]

  test.each([
    ['height set', { height: 7, aspectRatio: r169 }, 112 / 9, 7],
    ['width set', { width: 160, aspectRatio: r169 }, 160, 90],
    ['min height only', { minHeight: 7, aspectRatio: r169 }, 112 / 9, 7],
    ['min width only', { minWidth: 160, aspectRatio: r169 }, 160, 90],
  ] as const)('%s derives with one rounding', (_, input, width, height) => {
    const frame = Frame.make(input)
    expect(frame.width).toBe(width)
    expect(frame.height).toBe(height)
  })

  test('a ratio over 1 behaves as its number', () => {
    for (const input of [{ height: 7 }, { width: 7 }, { minHeight: 3 }, {}]) {
      const pair = Frame.make({ ...input, aspectRatio: [16 / 9, 1] })
      const number = Frame.make({ ...input, aspectRatio: 16 / 9 })
      expect([pair.width, pair.height]).toEqual([number.width, number.height])
    }
  })

  test('toJSON keeps the pair and a JSON round trip restores it', () => {
    const frame = Frame.make({ height: 7, aspectRatio: r169 })
    expect(frame.toJSON().aspectRatio).toBe(r169)
    const revived = Frame.make(JSON.parse(JSON.stringify(frame)))
    expect(revived.toJSON().aspectRatio).toEqual(r169)
    expect(revived.width).toBe(112 / 9)
  })

  test('setAspectRatio takes a pair', () => {
    expect(Frame.setAspectRatio(Frame.make({ height: 7 }), r169).width).toBe(112 / 9)
    expect(Frame.make({ height: 7 }).pipe(Frame.setAspectRatio(r169)).width).toBe(112 / 9)
  })

  test('flex items derive through the pair', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ height: 7, aspectRatio: r169 })],
        Flexbox.make({}),
        Rect.make(400),
      ),
    ).toEqual([Rect.make(0, 0, 112 / 9, 7)])
  })
})
