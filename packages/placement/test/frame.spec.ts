import { describe, expect, test } from 'vitest'
import {
  frame,
  isFrame,
  setAlign,
  setAspectRatio,
  setGrow,
  setHeight,
  setMaxHeight,
  setMaxSize,
  setMaxWidth,
  setMinHeight,
  setMinSize,
  setMinWidth,
  setOffset,
  setOffsetBottom,
  setOffsetLeft,
  setOffsetRight,
  setOffsetTop,
  setOffsetX,
  setOffsetY,
  setShrink,
  setSize,
  setStretch,
  setWidth,
} from '../src/frame.ts'

describe('frame', () => {
  test('empty input applies the defaults', () => {
    const result = frame({})
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
    const result = frame({ width: 100, height: 50 })
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
    expect(result.aspectRatio).toBe(2)
  })

  test('aspect ratio derives the missing dimension', () => {
    expect(frame({ width: 100, aspectRatio: 2 }).height).toBe(50)
    expect(frame({ height: 50, aspectRatio: 2 }).width).toBe(100)
  })

  test('aspect ratio alone applies against the clamped fallbacks', () => {
    const fromHeight = frame({ aspectRatio: 2, minHeight: 100 })
    expect(fromHeight.width).toBe(200)
    expect(fromHeight.height).toBe(100)

    const fromWidth = frame({ aspectRatio: 2, minWidth: 100 })
    expect(fromWidth.width).toBe(100)
    expect(fromWidth.height).toBe(50)
  })

  test('min and max constraints clamp the resolved size', () => {
    expect(frame({ width: 100, maxWidth: 80 }).width).toBe(80)
    expect(frame({ width: 100, minWidth: 150 }).width).toBe(150)
    expect(frame({ height: 100, maxHeight: 80 }).height).toBe(80)
  })

  test('resolved aspect ratio is exact IEEE division', () => {
    expect(frame({ width: 0.1, height: 0.2 }).aspectRatio).toBe(0.1 / 0.2)
  })
})

describe('guards', () => {
  test('isFrame', () => {
    expect(isFrame(frame({}))).toBe(true)
    expect(isFrame({ width: 100 })).toBe(false)
    expect(isFrame(null)).toBe(false)
  })
})

describe('sizing resolves lazily from raw inputs', () => {
  test('unset height re-derives after setWidth (regression: sentinel destruction)', () => {
    const start = frame({ width: 100, aspectRatio: 2 })
    expect(start.height).toBe(50)
    expect(setWidth(start, 200).height).toBe(100)
  })

  test('unset width re-derives after setHeight', () => {
    const start = frame({ height: 50, aspectRatio: 2 })
    expect(start.width).toBe(100)
    expect(setHeight(start, 100).width).toBe(200)
  })

  test('unset aspect ratio stays unset through setters', () => {
    const result = setWidth(frame({ width: 100, height: 50 }), 200)
    expect(result.height).toBe(50)
    expect(result.aspectRatio).toBe(4)
  })

  test('raw width survives clamping: raising the max un-clamps', () => {
    const start = frame({ width: 100, maxWidth: 80 })
    expect(start.width).toBe(80)
    expect(setMaxWidth(start, 200).width).toBe(100)
  })

  test('constraints keep applying to values set later', () => {
    expect(setWidth(frame({ maxWidth: 150 }), 200).width).toBe(150)
  })

  test('setters chain without leaking resolved values', () => {
    const result = frame({ aspectRatio: 2 }).pipe(setWidth(100), setMinHeight(60))
    expect(result.width).toBe(100)
    expect(result.height).toBe(60)
  })
})

describe('setOffset', () => {
  test('one value sets all four offsets', () => {
    const result = setOffset(frame({}), 10)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetRight).toBe(10)
    expect(result.offsetBottom).toBe(10)
    expect(result.offsetLeft).toBe(10)
  })

  test('two values are y and x', () => {
    const result = setOffset(frame({}), 10, 20)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetRight).toBe(20)
    expect(result.offsetBottom).toBe(10)
    expect(result.offsetLeft).toBe(20)
  })

  test('four values are top, right, bottom, left', () => {
    const result = setOffset(frame({}), 1, 2, 3, 4)
    expect(result.offsetTop).toBe(1)
    expect(result.offsetRight).toBe(2)
    expect(result.offsetBottom).toBe(3)
    expect(result.offsetLeft).toBe(4)
  })

  test('data-last forms (regression: multi-arg calls used to dispatch data-first)', () => {
    expect(frame({}).pipe(setOffset(10)).offsetTop).toBe(10)

    const yx = frame({}).pipe(setOffset(10, 20))
    expect(isFrame(yx)).toBe(true)
    expect(yx.offsetTop).toBe(10)
    expect(yx.offsetLeft).toBe(20)

    const trbl = frame({}).pipe(setOffset(1, 2, 3, 4))
    expect(trbl.offsetTop).toBe(1)
    expect(trbl.offsetRight).toBe(2)
    expect(trbl.offsetBottom).toBe(3)
    expect(trbl.offsetLeft).toBe(4)
  })
})

describe('setOffsetX', () => {
  test('one value sets both horizontal offsets', () => {
    const result = setOffsetX(frame({}), 10)
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(10)
  })

  test('two values are left and right', () => {
    const result = setOffsetX(frame({}), 10, 20)
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(frame({}).pipe(setOffsetX(10)).offsetRight).toBe(10)

    const result = frame({}).pipe(setOffsetX(10, 20))
    expect(result.offsetLeft).toBe(10)
    expect(result.offsetRight).toBe(20)
  })
})

describe('setOffsetY', () => {
  test('one value sets both vertical offsets', () => {
    const result = setOffsetY(frame({}), 10)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(10)
  })

  test('two values are top and bottom', () => {
    const result = setOffsetY(frame({}), 10, 20)
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(20)
  })

  test('data-last forms (regression)', () => {
    expect(frame({}).pipe(setOffsetY(10)).offsetBottom).toBe(10)

    const result = frame({}).pipe(setOffsetY(10, 20))
    expect(result.offsetTop).toBe(10)
    expect(result.offsetBottom).toBe(20)
  })
})

describe('single-edge offsets', () => {
  test('setOffsetTop', () => {
    expect(setOffsetTop(frame({}), 5).offsetTop).toBe(5)
    expect(frame({}).pipe(setOffsetTop(5)).offsetTop).toBe(5)
  })

  test('setOffsetRight', () => {
    expect(setOffsetRight(frame({}), 5).offsetRight).toBe(5)
    expect(frame({}).pipe(setOffsetRight(5)).offsetRight).toBe(5)
  })

  test('setOffsetBottom', () => {
    expect(setOffsetBottom(frame({}), 5).offsetBottom).toBe(5)
    expect(frame({}).pipe(setOffsetBottom(5)).offsetBottom).toBe(5)
  })

  test('setOffsetLeft', () => {
    expect(setOffsetLeft(frame({}), 5).offsetLeft).toBe(5)
    expect(frame({}).pipe(setOffsetLeft(5)).offsetLeft).toBe(5)
  })

  test('an edge setter leaves the other edges alone', () => {
    const result = setOffsetTop(frame({ offsetLeft: 1 }), 5)
    expect(result.offsetLeft).toBe(1)
    expect(result.offsetBottom).toBe(0)
  })
})

describe('setSize', () => {
  test('width comes first (regression: argument order flipped from height-first)', () => {
    const result = setSize(frame({}), 100, 50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both dimensions', () => {
    const result = setSize(frame({}), 100)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  test('data-last forms (regression: two-arg call used to dispatch data-first)', () => {
    const result = frame({}).pipe(setSize(100, 50))
    expect(isFrame(result)).toBe(true)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
    expect(frame({}).pipe(setSize(100)).height).toBe(100)
  })
})

describe('setWidth and setHeight', () => {
  test('setWidth', () => {
    expect(setWidth(frame({}), 100).width).toBe(100)
    expect(frame({}).pipe(setWidth(100)).width).toBe(100)
  })

  test('setHeight', () => {
    expect(setHeight(frame({}), 50).height).toBe(50)
    expect(frame({}).pipe(setHeight(50)).height).toBe(50)
  })
})

describe('setAspectRatio', () => {
  test('derives the unset dimension', () => {
    expect(setAspectRatio(frame({ width: 100 }), 4).height).toBe(25)
  })

  test('data-last form', () => {
    expect(frame({ height: 25 }).pipe(setAspectRatio(4)).width).toBe(100)
  })
})

describe('setMinSize', () => {
  test('width comes first', () => {
    const result = setMinSize(frame({}), 100, 50)
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both minimums', () => {
    const result = setMinSize(frame({}), 100)
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(100)
  })

  test('data-last forms (regression)', () => {
    const result = frame({}).pipe(setMinSize(100, 50))
    expect(result.minWidth).toBe(100)
    expect(result.minHeight).toBe(50)
    expect(frame({}).pipe(setMinSize(100)).minHeight).toBe(100)
  })
})

describe('setMinWidth and setMinHeight', () => {
  test('setMinWidth', () => {
    expect(setMinWidth(frame({}), 100).minWidth).toBe(100)
    expect(frame({}).pipe(setMinWidth(100)).minWidth).toBe(100)
  })

  test('setMinHeight', () => {
    expect(setMinHeight(frame({}), 50).minHeight).toBe(50)
    expect(frame({}).pipe(setMinHeight(50)).minHeight).toBe(50)
  })
})

describe('setMaxSize', () => {
  test('width comes first', () => {
    const result = setMaxSize(frame({ width: 500, height: 400 }), 100, 50)
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('one value sets both maximums', () => {
    const result = setMaxSize(frame({}), 100)
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(100)
  })

  test('data-last forms (regression)', () => {
    const result = frame({}).pipe(setMaxSize(100, 50))
    expect(result.maxWidth).toBe(100)
    expect(result.maxHeight).toBe(50)
    expect(frame({}).pipe(setMaxSize(100)).maxHeight).toBe(100)
  })
})

describe('setMaxWidth and setMaxHeight', () => {
  test('setMaxWidth', () => {
    expect(setMaxWidth(frame({}), 100).maxWidth).toBe(100)
    expect(frame({}).pipe(setMaxWidth(100)).maxWidth).toBe(100)
  })

  test('setMaxHeight', () => {
    expect(setMaxHeight(frame({}), 50).maxHeight).toBe(50)
    expect(frame({}).pipe(setMaxHeight(50)).maxHeight).toBe(50)
  })
})

describe('flex and placement setters', () => {
  test('setGrow', () => {
    expect(setGrow(frame({}), 1).grow).toBe(1)
    expect(frame({}).pipe(setGrow(1)).grow).toBe(1)
  })

  test('setShrink', () => {
    expect(setShrink(frame({}), 1).shrink).toBe(1)
    expect(frame({}).pipe(setShrink(1)).shrink).toBe(1)
  })

  test('setAlign', () => {
    expect(setAlign(frame({}), 0.5).align).toBe(0.5)
    expect(frame({}).pipe(setAlign(0.5)).align).toBe(0.5)
  })

  test('setStretch', () => {
    expect(setStretch(frame({}), 1).stretch).toBe(1)
    expect(frame({}).pipe(setStretch(1)).stretch).toBe(1)
  })
})

describe('serialization', () => {
  test('toJSON emits raw inputs; unset sizing keys are absent', () => {
    expect(JSON.parse(JSON.stringify(frame({ width: 100, offsetTop: 5 })))).toEqual({
      offsetTop: 5,
      offsetRight: 0,
      offsetBottom: 0,
      offsetLeft: 0,
      width: 100,
      grow: 0,
      shrink: 0,
      // Infinity (inherit) has no JSON encoding; it serializes as null.
      align: null,
      stretch: null,
    })
  })
})
