import { describe, expect, test } from 'vitest'
import * as Flexbox from '../src/flexbox.ts'
import * as Frame from '../src/frame.ts'
import * as Length from '../src/length.ts'
import * as Rect from '../src/rect.ts'

function c(
  layout: Flexbox.Flexbox,
  parent: Rect.Rect,
  frames: ReadonlyArray<Frame.Frame>,
  rects: ReadonlyArray<Rect.Rect>,
): [string, () => void] {
  return [
    `${JSON.stringify(frames)}: ${JSON.stringify(layout)}: ${JSON.stringify(parent)}: ${JSON.stringify(rects)}`,
    () => {
      expect(Flexbox.apply(frames, layout, parent)).toEqual(rects)
    },
  ]
}

function square(size: number) {
  return Frame.make({ width: size, aspectRatio: 1 })
}

function rectangle(width: number, height: number) {
  return Frame.make({ width, height })
}

function lineCount(rects: ReadonlyArray<Rect.Rect>) {
  return new Set(rects.map((r) => r.y)).size
}

describe('flexbox', () => {
  test('empty input applies the defaults', () => {
    const result = Flexbox.make({})
    expect(result.direction).toBe(Flexbox.direction.row)
    expect(result.wrap).toBe(Flexbox.wrap.nowrap)
    expect(result.justifyContent).toBe(0)
    expect(result.alignItems).toBe(0)
    expect(result.stretchItems).toBe(0)
    expect(result.stretchContent).toBe(0)
    expect(result.rowGap).toBe(0)
    expect(result.columnGap).toBe(0)
  })

  test('axis getters follow the direction', () => {
    const rowBox = Flexbox.make({ rowGap: 10, columnGap: 20 })
    expect(rowBox.isRow).toBe(true)
    expect(rowBox.isReverse).toBe(false)
    expect(rowBox.mainGap).toBe(20)
    expect(rowBox.crossGap).toBe(10)

    const columnBox = Flexbox.make({
      direction: Flexbox.direction.columnReverse,
      rowGap: 10,
      columnGap: 20,
    })
    expect(columnBox.isRow).toBe(false)
    expect(columnBox.isReverse).toBe(true)
    expect(columnBox.mainGap).toBe(10)
    expect(columnBox.crossGap).toBe(20)
  })

  test('input types are exported', () => {
    const flexDirection: Flexbox.FlexDirection = Flexbox.direction.columnReverse
    const flexWrap: Flexbox.FlexWrap = Flexbox.wrap.wrapReverse
    const input: Flexbox.FlexboxInput = { direction: flexDirection, wrap: flexWrap }
    expect(Flexbox.isFlexbox(Flexbox.make(input))).toBe(true)
  })
})

describe('guards', () => {
  test('isFlexbox', () => {
    expect(Flexbox.isFlexbox(Flexbox.make({}))).toBe(true)
    expect(Flexbox.isFlexbox({ direction: 0 })).toBe(false)
    expect(Flexbox.isFlexbox(null)).toBe(false)
  })
})

test('apply of no frames is empty', () => {
  expect(Flexbox.apply([], Flexbox.make({}), Rect.make(100))).toEqual([])
})

describe('direction', () => {
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(100, 0, 100), Rect.make(200, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, 100, 100), Rect.make(0, 200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.rowReverse }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(900, 0, 100), Rect.make(800, 0, 100), Rect.make(700, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.columnReverse }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(0, 900, 100), Rect.make(0, 800, 100), Rect.make(0, 700, 100)],
    ),
  )
})

describe('wrap', () => {
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.nowrap }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(100, 0, 100), Rect.make(200, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.wrap }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, 100, 100), Rect.make(0, 200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, -100, 100), Rect.make(0, -200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, wrap: Flexbox.wrap.nowrap }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, 100, 100), Rect.make(0, 200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, wrap: Flexbox.wrap.wrap }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(100, 0, 100), Rect.make(200, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(100),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(-100, 0, 100), Rect.make(-200, 0, 100)],
    ),
  )

  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.wrap }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(100, 0, 100), Rect.make(0, 100, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(0, 100, 100), Rect.make(100, 100, 100), Rect.make(0, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, wrap: Flexbox.wrap.wrap }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, 100, 100), Rect.make(100, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(100, 0, 100), Rect.make(100, 100, 100), Rect.make(0, 0, 100)],
    ),
  )

  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.wrap }),
      Rect.make(300),
      [square(100), rectangle(200, 100), rectangle(200, 100), square(100)],
      [
        Rect.make(0, 0, 100),
        Rect.make(100, 0, 200, 100),
        Rect.make(0, 100, 200, 100),
        Rect.make(200, 100, 100),
      ],
    ),
  )
})

describe('reverse and wrap combined', () => {
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.rowReverse, wrap: Flexbox.wrap.wrap }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(100, 0, 100), Rect.make(0, 0, 100), Rect.make(100, 100, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.rowReverse, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(100, 100, 100), Rect.make(0, 100, 100), Rect.make(100, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.columnReverse, wrap: Flexbox.wrap.wrap }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(0, 100, 100), Rect.make(0, 0, 100), Rect.make(100, 100, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.columnReverse, wrap: Flexbox.wrap.wrapReverse }),
      Rect.make(200),
      [square(100), square(100), square(100)],
      [Rect.make(100, 100, 100), Rect.make(100, 0, 100), Rect.make(0, 100, 100)],
    ),
  )
})

describe('gap', () => {
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, columnGap: 10 }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(110, 0, 100), Rect.make(220, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.column, rowGap: 10 }),
      Rect.make(1000),
      [square(100), square(100), square(100)],
      [Rect.make(0, 0, 100), Rect.make(0, 110, 100), Rect.make(0, 220, 100)],
    ),
  )

  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, columnGap: 10, wrap: Flexbox.wrap.wrap }),
      Rect.make(210),
      [square(100), square(100), square(100), square(100)],
      [
        Rect.make(0, 0, 100),
        Rect.make(110, 0, 100),
        Rect.make(0, 100, 100),
        Rect.make(110, 100, 100),
      ],
    ),
  )
  test(
    ...c(
      Flexbox.make({ direction: Flexbox.direction.row, rowGap: 10, wrap: Flexbox.wrap.wrap }),
      Rect.make(210),
      [square(100), square(100), square(100), square(100)],
      [
        Rect.make(0, 0, 100),
        Rect.make(100, 0, 100),
        Rect.make(0, 110, 100),
        Rect.make(100, 110, 100),
      ],
    ),
  )
  test(
    ...c(
      Flexbox.make({
        direction: Flexbox.direction.row,
        columnGap: 10,
        rowGap: 10,
        wrap: Flexbox.wrap.wrap,
      }),
      Rect.make(210),
      [square(100), square(100), square(100), square(100)],
      [
        Rect.make(0, 0, 100),
        Rect.make(110, 0, 100),
        Rect.make(0, 110, 100),
        Rect.make(110, 110, 100),
      ],
    ),
  )
})

describe('grow and shrink', () => {
  test(
    ...c(
      Flexbox.make({}),
      Rect.make(400, 100),
      [
        Frame.make({ width: 100, height: 100, grow: 1 }),
        Frame.make({ width: 100, height: 100, grow: 1 }),
      ],
      [Rect.make(0, 0, 200, 100), Rect.make(200, 0, 200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({}),
      Rect.make(400, 100),
      [Frame.make({ grow: 1, height: 100 }), Frame.make({ grow: 1, height: 100 })],
      [Rect.make(0, 0, 200, 100), Rect.make(200, 0, 200, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({}),
      Rect.make(100, 50),
      [
        Frame.make({ width: 100, height: 50, shrink: 1 }),
        Frame.make({ width: 100, height: 50, shrink: 1 }),
      ],
      [Rect.make(0, 0, 50, 50), Rect.make(50, 0, 50, 50)],
    ),
  )

  test('frames without grow keep their basis', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100 }), Frame.make({ width: 100, height: 100, grow: 1 })],
        Flexbox.make({}),
        Rect.make(400, 100),
      ),
    ).toEqual([Rect.make(0, 0, 100, 100), Rect.make(100, 0, 300, 100)])
  })
})

describe('min and max constraints', () => {
  test('maxWidth caps growth; the remainder goes to unconstrained items', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 100, grow: 1, maxWidth: 120 }),
          Frame.make({ width: 100, height: 100, grow: 1 }),
        ],
        Flexbox.make({}),
        Rect.make(400, 100),
      ),
    ).toEqual([Rect.make(0, 0, 120, 100), Rect.make(120, 0, 280, 100)])
  })

  test('minWidth floors shrinkage; the excess comes from unconstrained items', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 50, shrink: 1, minWidth: 80 }),
          Frame.make({ width: 100, height: 50, shrink: 1 }),
        ],
        Flexbox.make({}),
        Rect.make(100, 50),
      ),
    ).toEqual([Rect.make(0, 0, 80, 50), Rect.make(80, 0, 20, 50)])
  })

  test('maxHeight caps inherited stretch', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 50, maxHeight: 120 })],
        Flexbox.make({ stretchItems: 1 }),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 120)])
  })
})

describe('offsets', () => {
  test(
    ...c(
      Flexbox.make({}),
      Rect.make(1000),
      [Frame.make({ width: 100, height: 100, offsetLeft: 10, offsetRight: 20 }), square(100)],
      [Rect.make(10, 0, 100), Rect.make(130, 0, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({}),
      Rect.make(300),
      [Frame.make({ width: 100, height: 100, offsetTop: 25 })],
      [Rect.make(0, 25, 100)],
    ),
  )
  test(
    ...c(
      Flexbox.make({ alignItems: 1 }),
      Rect.make(300),
      [Frame.make({ width: 100, height: 100, offsetBottom: 10 })],
      [Rect.make(0, 190, 100)],
    ),
  )
})

describe('auto margin offsets', () => {
  test('an auto cross-start offset pushes the item to the cross end', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetTop: Number.POSITIVE_INFINITY })],
        Flexbox.make({}),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 200, 100)])
  })

  test('auto offsets on both cross sides center the item', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({
            width: 100,
            height: 100,
            offsetTop: Number.POSITIVE_INFINITY,
            offsetBottom: Number.POSITIVE_INFINITY,
          }),
        ],
        Flexbox.make({}),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 100, 100)])
  })

  test('auto cross offsets defeat inherited stretch', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetTop: Number.POSITIVE_INFINITY })],
        Flexbox.make({ stretchItems: 1 }),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 200, 100)])
  })

  test('an auto main-start offset pushes the item to the main end (regression)', () => {
    // The sequence walkers used to add the raw Infinity sentinel instead of
    // the definite offset, and that produced Infinity positions.
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetLeft: Number.POSITIVE_INFINITY })],
        Flexbox.make({}),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(200, 0, 100)])
  })

  test('auto offsets on both main sides center the item', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({
            width: 100,
            height: 100,
            offsetLeft: Number.POSITIVE_INFINITY,
            offsetRight: Number.POSITIVE_INFINITY,
          }),
        ],
        Flexbox.make({}),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(100, 0, 100)])
  })

  test('auto main offsets split free space between items', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 100, offsetRight: Number.POSITIVE_INFINITY }),
          Frame.make({ width: 100, height: 100, offsetLeft: Number.POSITIVE_INFINITY }),
        ],
        Flexbox.make({}),
        Rect.make(500, 100),
      ),
    ).toEqual([Rect.make(0, 0, 100), Rect.make(400, 0, 100)])
  })
})

describe('stretchItems', () => {
  test('stretches items that do not set their own stretch', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 50 }), Frame.make({ width: 100, height: 80 })],
        Flexbox.make({ stretchItems: 1 }),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 200), Rect.make(100, 0, 100, 200)])
  })

  test('a frame stretch of 0 overrides the container', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 50, stretch: 0 }),
          Frame.make({ width: 100, height: 50 }),
        ],
        Flexbox.make({ stretchItems: 1 }),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 50), Rect.make(100, 0, 100, 200)])
  })

  test('fractional stretchItems is inherited as-is', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 50 })],
        Flexbox.make({ stretchItems: 0.5 }),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 125)])
  })

  test('a frame stretch applies without any container stretchItems', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 50, stretch: 1 }),
          Frame.make({ width: 100, height: 50 }),
        ],
        Flexbox.make({}),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 200), Rect.make(100, 0, 100, 50)])
  })

  test('by default nothing stretches', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 50 })],
        Flexbox.make({}),
        Rect.make(300, 200),
      ),
    ).toEqual([Rect.make(0, 0, 100, 50)])
  })
})

test(
  ...c(
    Flexbox.make({
      direction: Flexbox.direction.row,
      columnGap: 10,
      rowGap: 10,
      wrap: Flexbox.wrap.wrap,
      alignItems: 0.5,
      alignContent: 0.5,
      justifyContent: 0.5,
    }),
    Rect.make(1000),
    Array.from({ length: 10 }, () => square(100)),
    [
      Rect.make(10, 395, 100),
      Rect.make(120, 395, 100),
      Rect.make(230, 395, 100),
      Rect.make(340, 395, 100),
      Rect.make(450, 395, 100),
      Rect.make(560, 395, 100),
      Rect.make(670, 395, 100),
      Rect.make(780, 395, 100),
      Rect.make(890, 395, 100),
      Rect.make(450, 505, 100),
    ],
  ),
)

test(
  ...c(
    Flexbox.make({
      direction: Flexbox.direction.row,
      columnGap: 10,
      rowGap: 10,
      wrap: Flexbox.wrap.wrap,
      alignItems: 0.5,
      alignContent: 0.5,
      justifyContent: 0.5,
    }),
    Rect.make(1000),
    Array.from({ length: 9 }, () => square(100)),
    [
      Rect.make(10, 450, 100),
      Rect.make(120, 450, 100),
      Rect.make(230, 450, 100),
      Rect.make(340, 450, 100),
      Rect.make(450, 450, 100),
      Rect.make(560, 450, 100),
      Rect.make(670, 450, 100),
      Rect.make(780, 450, 100),
      Rect.make(890, 450, 100),
    ],
  ),
)

test(
  ...c(
    Flexbox.make({
      direction: Flexbox.direction.row,
      wrap: Flexbox.wrap.wrap,
    }),
    Rect.make(10, 10, 1000),
    [square(100), square(100), square(100), square(100)],
    [
      Rect.make(10, 10, 100),
      Rect.make(110, 10, 100),
      Rect.make(210, 10, 100),
      Rect.make(310, 10, 100),
    ],
  ),
)

describe('serialization', () => {
  test('toJSON emits the configuration', () => {
    expect(
      JSON.parse(JSON.stringify(Flexbox.make({ direction: Flexbox.direction.column, rowGap: 5 }))),
    ).toEqual({
      direction: 2,
      wrap: 0,
      justifyContent: 0,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
      alignItems: 0,
      stretchItems: 0,
      alignContent: 0,
      alignContentSpace: 0,
      alignContentSpaceOuter: 0,
      stretchContent: 0,
      rowGap: 5,
      columnGap: 0,
    })
  })
})

describe('wrap with a lone overflowing frame (regression)', () => {
  // The flush branch used to emit an overflowing first frame on its own line
  // AND at the head of the next line. It then returned more rects than frames.
  test('one frame wider than the container yields exactly one rect', () => {
    const result = Flexbox.apply(
      [Frame.make({ width: 200, height: 200 })],
      Flexbox.make({ wrap: Flexbox.wrap.wrap }),
      Rect.make(100),
    )
    expect(result).toEqual([Rect.make(0, 0, 200, 200)])
  })

  test('an overflowing first frame keeps its own line', () => {
    const result = Flexbox.apply(
      [Frame.make({ width: 200, height: 50 }), Frame.make({ width: 50, height: 50 })],
      Flexbox.make({ wrap: Flexbox.wrap.wrap }),
      Rect.make(100),
    )
    expect(result).toEqual([Rect.make(0, 0, 200, 50), Rect.make(0, 50, 50, 50)])
  })

  test('an overflowing later frame wraps onto its own line', () => {
    const result = Flexbox.apply(
      [Frame.make({ width: 50, height: 50 }), Frame.make({ width: 200, height: 50 })],
      Flexbox.make({ wrap: Flexbox.wrap.wrap }),
      Rect.make(100),
    )
    expect(result).toEqual([Rect.make(0, 0, 50, 50), Rect.make(0, 50, 200, 50)])
  })
})

describe('non-finite stretch inherits (regression)', () => {
  test('a NaN per-item stretch inherits stretchItems, like align does', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, stretch: Number.NaN })],
        Flexbox.make({ stretchItems: 1 }),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 0, 100, 300)])
  })
})

describe('cross min lands on the joined line (regression)', () => {
  // minCrossSize used to accumulate before the wrap flush. That folded the
  // cross min of a wrapping item into the height of the line it is NOT on.
  test('a wrapping item contributes its cross min to its own line', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: 100, height: 10 }),
          Frame.make({ width: 100, height: 50, minHeight: 50 }),
        ],
        Flexbox.make({ wrap: Flexbox.wrap.wrap }),
        Rect.make(100),
      ),
    ).toEqual([Rect.make(0, 0, 100, 10), Rect.make(0, 10, 100, 50)])
  })
})

describe('wrap decision is tolerance-aware (regression)', () => {
  // The overflow check used a raw float comparison, so rounding residue
  // (0.1 * 3 sums past 0.3) wrapped a line that the same layout scaled by
  // 10 kept whole. That broke scale invariance (see PRECISION.md).
  test('0.1-wide items in a 0.3-wide parent stay on one line, like the layout scaled by 10', () => {
    const small = Flexbox.apply(
      Array.from({ length: 3 }, () => Frame.make({ width: 0.1, height: 1 })),
      Flexbox.make({ wrap: Flexbox.wrap.wrap }),
      Rect.make(0.3, 1),
    )
    const large = Flexbox.apply(
      Array.from({ length: 3 }, () => Frame.make({ width: 1, height: 10 })),
      Flexbox.make({ wrap: Flexbox.wrap.wrap }),
      Rect.make(3, 10),
    )

    expect(lineCount(large)).toBe(1)
    expect(lineCount(small)).toBe(lineCount(large))
  })
})

describe('offsets are physical in reversed flows (regression)', () => {
  // The main track is laid out logically and reflected afterward, margins
  // included. In reversed flows, computeItem swaps the offset sources so
  // each margin lands on its named physical side.
  test('rowReverse keeps offsetLeft on the physical left of the item', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetLeft: 10 }), square(100)],
        Flexbox.make({ direction: Flexbox.direction.rowReverse }),
        Rect.make(1000),
      ),
    ).toEqual([Rect.make(900, 0, 100), Rect.make(790, 0, 100)])
  })

  test('columnReverse keeps offsetTop physically above the item', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetTop: 10 })],
        Flexbox.make({ direction: Flexbox.direction.columnReverse }),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 200, 100)])
  })

  test('an auto offsetLeft pushes the item to the physical right in rowReverse', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetLeft: Number.POSITIVE_INFINITY })],
        Flexbox.make({ direction: Flexbox.direction.rowReverse }),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(200, 0, 100)])
  })

  test('an auto offsetBottom pushes the item to the physical top in columnReverse', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: 100, height: 100, offsetBottom: Number.POSITIVE_INFINITY })],
        Flexbox.make({ direction: Flexbox.direction.columnReverse }),
        Rect.make(300),
      ),
    ).toEqual([Rect.make(0, 0, 100)])
  })
})

describe('percentages', () => {
  const pct = Length.percent
  const inner = Rect.make(10, 20, 400, 200)

  test('frames resolve against the container rect', () => {
    expect(
      Flexbox.apply(
        [
          Frame.make({ width: pct(25), height: pct(50) }),
          Frame.make({ width: pct(50), height: 10, offsetLeft: pct(5), offsetTop: pct(10) }),
        ],
        Flexbox.make({}),
        inner,
      ),
    ).toEqual([Rect.make(10, 20, 100, 100), Rect.make(130, 40, 200, 10)])
  })

  test('a percentage frame lays out as its resolved frame', () => {
    const frames = [
      Frame.make({ width: pct(50), minHeight: pct(25), grow: 1 }),
      Frame.make({ width: 100, maxWidth: pct(20), offsetRight: pct(10) }),
      Frame.make({ width: 100, aspectRatio: 2 }),
    ]
    const layout = Flexbox.make({ wrap: Flexbox.wrap.wrap })
    expect(Flexbox.apply(frames, layout, inner)).toEqual(
      Flexbox.apply(
        frames.map((frame) => Frame.resolve(frame, inner)),
        layout,
        inner,
      ),
    )
  })

  test('a column container resolves on the same physical bases', () => {
    expect(
      Flexbox.apply(
        [Frame.make({ width: pct(50), height: pct(25) })],
        Flexbox.make({ direction: Flexbox.direction.column }),
        inner,
      ),
    ).toEqual([Rect.make(10, 20, 200, 50)])
  })
})
