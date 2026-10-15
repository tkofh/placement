import { describe, expect, test } from 'vitest'
import * as Flexbox from '../src/flexbox.ts'
import * as Frame from '../src/frame.ts'
import * as Rect from '../src/rect.ts'

describe('frame', () => {
  test('empty input applies the defaults', () => {
    const result = Frame.make({})
    expect(result.offsetTop).toBe(0)
    expect(result.offsetRight).toBe(0)
    expect(result.offsetBottom).toBe(0)
    expect(result.offsetLeft).toBe(0)
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

describe('setOffset', () => {
  test('one value sets all four offsets', () => {
    const result = Frame.setOffset(Frame.make({}), 10)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetRight).toBe(10)
    expect(result.offsetBottom).toBe(10)
    expect(result.offsetLeft).toBe(10)
  })

  test('two values are y and x', () => {
    const result = Frame.setOffset(Frame.make({}), 10, 20)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetRight).toBe(20)
    expect(result.offsetBottom).toBe(10)
    expect(result.offsetLeft).toBe(20)
  })

  test('four values are top, right, bottom, left', () => {
    const result = Frame.setOffset(Frame.make({}), 1, 2, 3, 4)
    expect(result.offsetTop).toBe(1)
    expect(result.offsetRight).toBe(2)
    expect(result.offsetBottom).toBe(3)
    expect(result.offsetLeft).toBe(4)
  })

  test('data-last forms (regression: multi-arg calls used to dispatch data-first)', () => {
    expect(Frame.make({}).pipe(Frame.setOffset(10)).offsetTop).toBe(10)

    const yx = Frame.make({}).pipe(Frame.setOffset(10, 20))
    expect(Frame.isFrame(yx)).toBe(true)
    expect(yx.offsetTop).toBe(10)
    expect(yx.offsetLeft).toBe(20)

    const trbl = Frame.make({}).pipe(Frame.setOffset(1, 2, 3, 4))
    expect(trbl.offsetTop).toBe(1)
    expect(trbl.offsetRight).toBe(2)
    expect(trbl.offsetBottom).toBe(3)
    expect(trbl.offsetLeft).toBe(4)
  })
})

describe('setOffsetX', () => {
  test('one value sets both horizontal offsets', () => {
    const result = Frame.setOffsetX(Frame.make({}), 10)
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(10)
  })

  test('two values are left and right', () => {
    const result = Frame.setOffsetX(Frame.make({}), 10, 20)
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(Frame.make({}).pipe(Frame.setOffsetX(10)).offsetRight).toBe(10)

    const result = Frame.make({}).pipe(Frame.setOffsetX(10, 20))
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(20)
  })
})

describe('setOffsetY', () => {
  test('one value sets both vertical offsets', () => {
    const result = Frame.setOffsetY(Frame.make({}), 10)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(10)
  })

  test('two values are top and bottom', () => {
    const result = Frame.setOffsetY(Frame.make({}), 10, 20)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(Frame.make({}).pipe(Frame.setOffsetY(10)).offsetBottom).toBe(10)

    const result = Frame.make({}).pipe(Frame.setOffsetY(10, 20))
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(20)
  })
})

describe('single-edge offsets', () => {
  test('setOffsetTop', () => {
    expect(Frame.setOffsetTop(Frame.make({}), 5).offsetTop).toBe(5)
    expect(Frame.make({}).pipe(Frame.setOffsetTop(5)).offsetTop).toBe(5)
  })

  test('setOffsetRight', () => {
    expect(Frame.setOffsetRight(Frame.make({}), 5).offsetRight).toBe(5)
    expect(Frame.make({}).pipe(Frame.setOffsetRight(5)).offsetRight).toBe(5)
  })

  test('setOffsetBottom', () => {
    expect(Frame.setOffsetBottom(Frame.make({}), 5).offsetBottom).toBe(5)
    expect(Frame.make({}).pipe(Frame.setOffsetBottom(5)).offsetBottom).toBe(5)
  })

  test('setOffsetLeft', () => {
    expect(Frame.setOffsetLeft(Frame.make({}), 5).offsetLeft).toBe(5)
    expect(Frame.make({}).pipe(Frame.setOffsetLeft(5)).offsetLeft).toBe(5)
  })

  test('an edge setter leaves the other edges alone', () => {
    const result = Frame.setOffsetTop(Frame.make({ offsetLeft: 1 }), 5)
    expect(result.offsetLeft).toBe(1)
    expect(result.offsetBottom).toBe(0)
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
    expect(JSON.parse(JSON.stringify(Frame.make({ width: 100, offsetTop: 5 })))).toEqual({
      offsetTop: 5,
      offsetRight: 0,
      offsetBottom: 0,
      offsetLeft: 0,
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

  describe('id', () => {
    test('an omitted id is undefined', () => {
      const frame: Frame.Frame<undefined> = Frame.make({ width: 10 })
      expect(frame.id).toBeUndefined()
      expect(JSON.parse(JSON.stringify(frame))).not.toHaveProperty('id')
    })

    test('make keeps the literal id type', () => {
      const frame: Frame.Frame<'start'> = Frame.make({ id: 'start', width: 10 })
      expect(frame.id).toBe('start')
      // @ts-expect-error -- the id type is the literal 'start'
      const other: Frame.Frame<'end'> = frame
      expect(other.id).toBe('start')
    })

    test('a JSON round trip keeps the id', () => {
      const frame = Frame.make({ id: 'a', width: 10 })
      expect(Frame.make(JSON.parse(JSON.stringify(frame))).id).toBe('a')
    })

    test('setId works in both forms and retypes the frame', () => {
      const base = Frame.make({ width: 10 })
      const named: Frame.Frame<'a'> = Frame.setId(base, 'a')
      const renamed: Frame.Frame<'b'> = named.pipe(Frame.setId('b'))
      const cleared: Frame.Frame<undefined> = Frame.setId(renamed, undefined)
      expect([named.id, renamed.id, cleared.id]).toEqual(['a', 'b', undefined])
      expect(renamed.width).toBe(10)
    })

    test('setters keep the id and its type', () => {
      const frame = Frame.make({ id: 'a', width: 10 })
      const wider: Frame.Frame<'a'> = Frame.setWidth(frame, 20)
      const offset: Frame.Frame<'a'> = frame.pipe(Frame.setOffset(1, 2))
      expect([wider.id, offset.id]).toEqual(['a', 'a'])
    })

    test('layouts that ignore ids accept any frame', () => {
      const rects = Flexbox.apply(
        [Frame.make({ id: 'a', width: 10 }), Frame.make({ width: 10 })],
        Flexbox.make({}),
        Rect.make(100),
      )
      expect(rects).toHaveLength(2)
    })
  })
})
