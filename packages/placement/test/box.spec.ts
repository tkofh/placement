import { describe, expect, test } from 'vitest'
import type * as AspectRatio from '../src/aspectRatio.ts'
import * as Box from '../src/box.ts'
import * as Rect from '../src/rect.ts'

const parent = Rect.make(400, 200)
const offsetParent = Rect.make(50, 25, 400, 200)

function c(
  name: string,
  input: Box.BoxInput,
  container: Rect.Rect,
  expected: Rect.Rect,
): [string, () => void] {
  return [
    `${name}: ${JSON.stringify(input)} in ${JSON.stringify(container)}`,
    () => {
      expect(Box.apply(Box.make(input), container)).toEqual(expected)
      expect(Box.make(input).pipe(Box.apply(container))).toEqual(expected)
    },
  ]
}

describe('box', () => {
  test('empty input applies the defaults', () => {
    const result = Box.make({})
    expect(result.top).toBeNaN()
    expect(result.right).toBeNaN()
    expect(result.bottom).toBeNaN()
    expect(result.left).toBeNaN()
    expect(result.width).toBeNaN()
    expect(result.height).toBeNaN()
    expect(result.aspectRatio).toBeNaN()
    expect(result.minWidth).toBe(0)
    expect(result.minHeight).toBe(0)
    expect(result.maxWidth).toBe(Number.POSITIVE_INFINITY)
    expect(result.maxHeight).toBe(Number.POSITIVE_INFINITY)
  })

  test('constraint getters normalize their raw inputs', () => {
    expect(Box.make({ minWidth: -5 }).minWidth).toBe(0)
    expect(Box.make({ maxHeight: -5 }).maxHeight).toBe(0)
    expect(Box.make({ minWidth: Number.POSITIVE_INFINITY }).minWidth).toBe(0)
    expect(Box.make({ maxWidth: Number.NaN }).maxWidth).toBe(Number.POSITIVE_INFINITY)
    // Crossed bounds: the maximum is raised to the minimum.
    const crossed = Box.make({ minWidth: 100, maxWidth: 50 })
    expect(crossed.minWidth).toBe(100)
    expect(crossed.maxWidth).toBe(100)
  })

  test('isBox accepts boxes and rejects everything else', () => {
    expect(Box.isBox(Box.make({}))).toBe(true)
    expect(Box.isBox(Rect.make(1, 2, 3, 4))).toBe(false)
    expect(Box.isBox({ top: 0, left: 0 })).toBe(false)
    expect(Box.isBox(null)).toBe(false)
  })

  test('a JSON round trip preserves unset fields', () => {
    const box = Box.make({ left: 10, width: 100, aspectRatio: 2 })
    const revived = Box.make(JSON.parse(JSON.stringify(box)))
    expect(revived.left).toBe(10)
    expect(revived.top).toBeNaN()
    expect(revived.height).toBeNaN()
    expect(Box.apply(revived, parent)).toEqual(Box.apply(box, parent))
  })

  test('a JSON round trip reads non-finite values back as unset', () => {
    const box = Box.make({ left: Number.NaN, top: Number.POSITIVE_INFINITY, width: 100 })
    const revived = Box.make(JSON.parse(JSON.stringify(box)))
    expect(revived.left).toBeNaN()
    expect(revived.top).toBeNaN()
    expect(Box.apply(revived, parent)).toEqual(Box.apply(box, parent))
  })

  describe('apply', () => {
    test.each([
      c(
        'left and top anchor',
        { left: 10, top: 20, width: 100, height: 50 },
        parent,
        Rect.make(10, 20, 100, 50),
      ),
      c(
        'right and bottom anchor',
        { right: 10, bottom: 5, width: 100, height: 50 },
        parent,
        Rect.make(290, 145, 100, 50),
      ),
      c(
        'over-constrained ignores right',
        { left: 10, right: 10, width: 100, height: 50 },
        parent,
        Rect.make(10, 0, 100, 50),
      ),
      c(
        'inset pairs determine the size',
        { left: 10, right: 30, top: 5, bottom: 5 },
        parent,
        Rect.make(10, 5, 360, 190),
      ),
      c(
        'single insets shrink the fill',
        { right: 40, top: 10 },
        parent,
        Rect.make(0, 10, 360, 190),
      ),
      c('no inputs fill the parent', {}, parent, Rect.make(0, 0, 400, 200)),
      c(
        'non-finite inputs act as unset',
        { left: Number.NaN, top: Number.POSITIVE_INFINITY, width: Number.NEGATIVE_INFINITY },
        parent,
        Rect.make(0, 0, 400, 200),
      ),
      c(
        'insets resolve from the parent origin',
        { left: 10, top: 20, width: 100, height: 50 },
        offsetParent,
        Rect.make(60, 45, 100, 50),
      ),
      c(
        'end anchors resolve from the parent origin',
        { right: 10, bottom: 5, width: 100, height: 50 },
        offsetParent,
        Rect.make(340, 170, 100, 50),
      ),
      c('the fill starts at the parent origin', {}, offsetParent, Rect.make(50, 25, 400, 200)),
      c(
        'ratio derives height from explicit width',
        { width: 100, aspectRatio: 2 },
        parent,
        Rect.make(0, 0, 100, 50),
      ),
      c(
        'ratio derives width from explicit height',
        { height: 50, aspectRatio: 2 },
        parent,
        Rect.make(0, 0, 100, 50),
      ),
      c(
        'ratio derives width from an inset-determined height',
        { top: 0, bottom: 0, aspectRatio: 1 },
        parent,
        Rect.make(0, 0, 200, 200),
      ),
      c(
        'ratio derives height from an inset-determined width',
        { left: 100, right: 100, aspectRatio: 2 },
        parent,
        Rect.make(100, 0, 200, 100),
      ),
      c(
        'ratio is ignored when both axes are determined',
        { width: 100, height: 100, aspectRatio: 2 },
        parent,
        Rect.make(0, 0, 100, 100),
      ),
      c(
        'ratio is ignored when neither axis is determined',
        { aspectRatio: 2 },
        parent,
        Rect.make(0, 0, 400, 200),
      ),
      c(
        'ratio derives from the clamped source',
        { width: 100, maxWidth: 50, aspectRatio: 2 },
        parent,
        Rect.make(0, 0, 50, 25),
      ),
      c(
        'constraints break a derived ratio',
        { height: 50, aspectRatio: 2, maxWidth: 80 },
        parent,
        Rect.make(0, 0, 80, 50),
      ),
      c(
        'the minimum raises the fill',
        { left: 10, right: 380, minWidth: 50, height: 50 },
        parent,
        Rect.make(10, 0, 50, 50),
      ),
      c(
        'the maximum clamps the fill',
        { maxWidth: 100, height: 50 },
        parent,
        Rect.make(0, 0, 100, 50),
      ),
      c(
        'the maximum clamps an explicit size',
        { width: 500, maxWidth: 100, height: 50 },
        parent,
        Rect.make(0, 0, 100, 50),
      ),
      c(
        'the minimum wins over a crossed maximum',
        { width: 500, minWidth: 200, maxWidth: 100, height: 50 },
        parent,
        Rect.make(0, 0, 200, 50),
      ),
      c(
        'end anchors measure with the used size',
        { right: 10, width: 500, maxWidth: 100, height: 50 },
        parent,
        Rect.make(290, 0, 100, 50),
      ),
      c(
        'end anchors measure a derived size',
        { right: 10, top: 0, height: 50, aspectRatio: 2 },
        parent,
        Rect.make(290, 0, 100, 50),
      ),
      c(
        'an overdrawn inset pair clamps to zero size',
        { left: 300, right: 300 },
        parent,
        Rect.make(300, 0, 0, 200),
      ),
      c(
        'negative insets overhang the parent',
        { left: -10, top: -5, width: 100, height: 50 },
        parent,
        Rect.make(-10, -5, 100, 50),
      ),
      c(
        'a zero size is explicit, not unset',
        { width: 0, right: 10, top: 0, bottom: 0 },
        parent,
        Rect.make(390, 0, 0, 200),
      ),
    ])('%s', (_, run) => run())
  })

  describe('inset setters', () => {
    test('setInset applies the CSS shorthand orders', () => {
      const all = Box.setInset(Box.make({}), 10)
      expect([all.top, all.right, all.bottom, all.left]).toEqual([10, 10, 10, 10])

      const yx = Box.make({}).pipe(Box.setInset(10, 20))
      expect([yx.top, yx.right, yx.bottom, yx.left]).toEqual([10, 20, 10, 20])

      const txb = Box.setInset(Box.make({}), 1, 2, 3)
      expect([txb.top, txb.right, txb.bottom, txb.left]).toEqual([1, 2, 3, 2])

      const trbl = Box.make({}).pipe(Box.setInset(1, 2, 3, 4))
      expect([trbl.top, trbl.right, trbl.bottom, trbl.left]).toEqual([1, 2, 3, 4])
    })

    test('setInsetX and setInsetY set their axis only', () => {
      const x = Box.setInsetX(Box.make({ top: 1 }), 5)
      expect([x.left, x.right, x.top]).toEqual([5, 5, 1])

      const xy = Box.make({}).pipe(Box.setInsetX(1, 2), Box.setInsetY(3, 4))
      expect([xy.top, xy.right, xy.bottom, xy.left]).toEqual([3, 2, 4, 1])
    })

    test.each([
      ['setTop', Box.setTop, 'top'],
      ['setRight', Box.setRight, 'right'],
      ['setBottom', Box.setBottom, 'bottom'],
      ['setLeft', Box.setLeft, 'left'],
    ] as const)('%s replaces one edge in both forms', (_, op, key) => {
      expect(op(Box.make({}), 7)[key]).toBe(7)
      expect(Box.make({}).pipe(op(7))[key]).toBe(7)
    })

    test('a non-finite inset unsets the edge', () => {
      const box = Box.setLeft(Box.make({ left: 10, width: 100 }), Number.NaN)
      expect(box.left).toBeNaN()
      expect(Box.apply(box, parent)).toEqual(Rect.make(0, 0, 100, 200))
    })
  })

  describe('sizing setters', () => {
    test('setSize sets both dimensions, width first', () => {
      const wh = Box.setSize(Box.make({}), 100, 50)
      expect([wh.width, wh.height]).toEqual([100, 50])
      expect(Box.make({}).pipe(Box.setSize(100)).height).toBe(100)
    })

    test('setWidth and setHeight keep the other dimension deriving', () => {
      const fromWidth = Box.setWidth(Box.make({ aspectRatio: 2 }), 100)
      expect(Box.apply(fromWidth, parent)).toEqual(Rect.make(0, 0, 100, 50))

      const fromHeight = Box.make({ aspectRatio: 2 }).pipe(Box.setHeight(50))
      expect(Box.apply(fromHeight, parent)).toEqual(Rect.make(0, 0, 100, 50))
    })

    test('setAspectRatio replaces the ratio in both forms', () => {
      expect(Box.apply(Box.setAspectRatio(Box.make({ width: 100 }), 4), parent)).toEqual(
        Rect.make(0, 0, 100, 25),
      )
      expect(Box.apply(Box.make({ width: 100 }).pipe(Box.setAspectRatio(4)), parent)).toEqual(
        Rect.make(0, 0, 100, 25),
      )
    })

    test('setMinSize and setMaxSize set both bounds, width first', () => {
      const min = Box.setMinSize(Box.make({}), 10, 20)
      expect([min.minWidth, min.minHeight]).toEqual([10, 20])
      expect(Box.make({}).pipe(Box.setMinSize(10)).minHeight).toBe(10)

      const max = Box.setMaxSize(Box.make({}), 100, 50)
      expect([max.maxWidth, max.maxHeight]).toEqual([100, 50])
      expect(Box.make({}).pipe(Box.setMaxSize(100)).maxHeight).toBe(100)
    })

    test.each([
      ['setMinWidth', Box.setMinWidth, 'minWidth'],
      ['setMinHeight', Box.setMinHeight, 'minHeight'],
      ['setMaxWidth', Box.setMaxWidth, 'maxWidth'],
      ['setMaxHeight', Box.setMaxHeight, 'maxHeight'],
    ] as const)('%s replaces one bound in both forms', (_, op, key) => {
      expect(op(Box.make({}), 42)[key]).toBe(42)
      expect(Box.make({}).pipe(op(42))[key]).toBe(42)
    })

    test('raising a maximum un-clamps a width set earlier', () => {
      const clamped = Box.make({ width: 100, maxWidth: 80 })
      expect(Box.apply(clamped, parent).width).toBe(80)
      expect(Box.apply(Box.setMaxWidth(clamped, 200), parent).width).toBe(100)
    })
  })
})

describe('box through a Proxy', () => {
  // Vue's `ref`/`reactive` wrap values in proxies, which `#private` fields reject.
  test('getters, toJSON, setters, and apply read through the proxy', () => {
    const box = new Proxy(Box.make({ top: 10, left: 20, width: 100, aspectRatio: 2 }), {})
    expect(box.top).toBe(10)
    expect(box.toJSON()).toEqual({ top: 10, left: 20, width: 100, aspectRatio: 2 })
    expect(Box.setTop(box, 5).top).toBe(5)
    expect(Box.apply(box, parent)).toEqual(Rect.make(20, 10, 100, 50))
  })
})

describe('aspect ratio pairs', () => {
  const r169: AspectRatio.AspectRatio = [16, 9]

  test('a pair derives the width with one rounding', () => {
    const box = Box.make({ height: 7, aspectRatio: r169 })
    expect(Box.apply(box, parent).width).toBe(112 / 9)
    expect(box.pipe(Box.apply(parent)).width).toBe(112 / 9)
  })

  test('a pair derives the height from inset-determined width', () => {
    expect(Box.apply(Box.make({ left: 0, right: 240, aspectRatio: r169 }), parent)).toEqual(
      Rect.make(0, 0, 160, 90),
    )
  })

  test('a ratio over 1 behaves as its number', () => {
    for (const input of [{ height: 7 }, { width: 7 }, { top: 0, bottom: 0 }]) {
      expect(Box.apply(Box.make({ ...input, aspectRatio: [16 / 9, 1] }), parent)).toEqual(
        Box.apply(Box.make({ ...input, aspectRatio: 16 / 9 }), parent),
      )
    }
  })

  test('the getter reads the value and toJSON keeps the pair', () => {
    const box = Box.make({ aspectRatio: r169 })
    expect(box.aspectRatio).toBe(16 / 9)
    expect(box.toJSON().aspectRatio).toBe(r169)
  })

  test('a JSON round trip keeps the pair', () => {
    const box = Box.make({ height: 7, aspectRatio: r169 })
    const revived = Box.make(JSON.parse(JSON.stringify(box)))
    expect(revived.toJSON().aspectRatio).toEqual(r169)
    expect(Box.apply(revived, parent)).toEqual(Box.apply(box, parent))
  })

  test('setAspectRatio takes a pair', () => {
    const box = Box.make({ height: 7 })
    expect(Box.apply(Box.setAspectRatio(box, r169), parent).width).toBe(112 / 9)
    expect(Box.apply(box.pipe(Box.setAspectRatio(r169)), parent).width).toBe(112 / 9)
  })

  test('a degenerate pair acts as unset', () => {
    const box = Box.make({ height: 10, aspectRatio: [1, 0] })
    expect(Box.apply(box, parent).width).toBe(400)
  })
})

describe('alignment', () => {
  const parent = Rect.make(400, 200)

  test('alignment fields default to inherit', () => {
    const box = Box.make({})
    expect([box.alignX, box.alignY, box.stretchX, box.stretchY]).toEqual([
      Infinity,
      Infinity,
      Infinity,
      Infinity,
    ])
  })

  test('align places a sized box in the room its insets leave', () => {
    expect(
      Box.apply(Box.make({ width: 100, height: 50, alignX: 0.5, alignY: 0.5 }), parent),
    ).toEqual(Rect.make(150, 75, 100, 50))
    expect(
      Box.apply(Box.make({ left: 20, right: 80, width: 100, height: 50, alignX: 1 }), parent),
    ).toEqual(Rect.make(220, 0, 100, 50))
  })

  test('an explicit align overrides the right-edge anchor', () => {
    expect(Box.apply(Box.make({ right: 10, width: 100, height: 50, alignX: 0 }), parent)).toEqual(
      Rect.make(0, 0, 100, 50),
    )
  })

  test('a stretch of 0 keeps an unset size at 0 in an inset pair', () => {
    expect(Box.apply(Box.make({ left: 10, right: 30, height: 20, stretchX: 0 }), parent)).toEqual(
      Rect.make(10, 0, 0, 20),
    )
  })

  test('a partial stretch moves the size toward the room', () => {
    expect(
      Box.apply(Box.make({ width: 100, height: 40, stretchX: 0.5, stretchY: 0.25 }), parent),
    ).toEqual(Rect.make(0, 0, 250, 80))
  })

  test('an explicit stretch fixes the axis, and the ratio follows it', () => {
    // By default the height would fill and the ratio would size the width.
    expect(Box.apply(Box.make({ aspectRatio: 2, stretchX: 1, stretchY: 0 }), parent)).toEqual(
      Rect.make(0, 0, 400, 200),
    )
    expect(Box.apply(Box.make({ aspectRatio: 4, stretchX: 1, stretchY: 0 }), parent)).toEqual(
      Rect.make(0, 0, 400, 100),
    )
  })

  test('an explicit stretch sizes the other axis for the default fill', () => {
    // The stretched height sizes the width through the ratio, so x does not fill.
    expect(Box.apply(Box.make({ aspectRatio: 1, stretchY: 0.5 }), parent)).toEqual(
      Rect.make(0, 0, 100, 100),
    )
  })

  test('setters work in both forms', () => {
    const box = Box.make({ width: 100, height: 50 })
    expect(Box.apply(Box.setAlign(box, 0.5), parent)).toEqual(Rect.make(150, 75, 100, 50))
    expect(Box.apply(box.pipe(Box.setAlign(1, 0)), parent)).toEqual(Rect.make(300, 0, 100, 50))
    expect(Box.setAlignX(box, 0.25).alignX).toBe(0.25)
    expect(box.pipe(Box.setAlignY(0.75)).alignY).toBe(0.75)
    expect(Box.apply(Box.setStretch(Box.make({}), 0.5), parent)).toEqual(Rect.make(0, 0, 200, 100))
    expect(Box.apply(Box.make({}).pipe(Box.setStretch(1, 0)), parent)).toEqual(
      Rect.make(0, 0, 400, 0),
    )
    expect(Box.setStretchX(box, 1).stretchX).toBe(1)
    expect(box.pipe(Box.setStretchY(1)).stretchY).toBe(1)
  })

  test('a JSON round trip keeps inherited alignment', () => {
    const box = Box.make({ alignX: 0.5, stretchY: Infinity })
    const back = Box.make(JSON.parse(JSON.stringify(box)))
    expect([back.alignX, back.stretchY]).toEqual([0.5, Infinity])
  })
})
