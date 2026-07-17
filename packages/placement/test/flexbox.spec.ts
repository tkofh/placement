import { describe, expect, test } from 'vitest'
import {
  type FlexDirection,
  type FlexWrap,
  type Flexbox,
  type FlexboxInput,
  applyFlexbox,
  direction,
  flexbox,
  isFlexbox,
  wrap,
} from '../src/flexbox.ts'
import { type Frame, frame } from '../src/frame.ts'
import { type Rect, rect } from '../src/rect.ts'

function c(
  layout: Flexbox,
  parent: Rect,
  frames: ReadonlyArray<Frame>,
  rects: ReadonlyArray<Rect>,
): [string, () => void] {
  return [
    `${JSON.stringify(frames)}: ${JSON.stringify(layout)}: ${JSON.stringify(parent)}: ${JSON.stringify(rects)}`,
    () => {
      expect(applyFlexbox(frames, layout, parent)).toEqual(rects)
    },
  ]
}

function square(size: number) {
  return frame({ width: size, aspectRatio: 1 })
}

function rectangle(width: number, height: number) {
  return frame({ width, height })
}

describe('flexbox', () => {
  test('empty input applies the defaults', () => {
    const result = flexbox({})
    expect(result.direction).toBe(direction.row)
    expect(result.wrap).toBe(wrap.nowrap)
    expect(result.justifyContent).toBe(0)
    expect(result.alignItems).toBe(0)
    expect(result.stretchItems).toBe(0)
    expect(result.stretchContent).toBe(0)
    expect(result.rowGap).toBe(0)
    expect(result.columnGap).toBe(0)
  })

  test('axis getters follow the direction', () => {
    const rowBox = flexbox({ rowGap: 10, columnGap: 20 })
    expect(rowBox.isRow).toBe(true)
    expect(rowBox.isReverse).toBe(false)
    expect(rowBox.mainGap).toBe(20)
    expect(rowBox.crossGap).toBe(10)

    const columnBox = flexbox({ direction: direction.columnReverse, rowGap: 10, columnGap: 20 })
    expect(columnBox.isRow).toBe(false)
    expect(columnBox.isReverse).toBe(true)
    expect(columnBox.mainGap).toBe(10)
    expect(columnBox.crossGap).toBe(20)
  })

  test('input types are exported', () => {
    const flexDirection: FlexDirection = direction.columnReverse
    const flexWrap: FlexWrap = wrap.wrapReverse
    const input: FlexboxInput = { direction: flexDirection, wrap: flexWrap }
    expect(isFlexbox(flexbox(input))).toBe(true)
  })
})

describe('guards', () => {
  test('isFlexbox', () => {
    expect(isFlexbox(flexbox({}))).toBe(true)
    expect(isFlexbox({ direction: 0 })).toBe(false)
    expect(isFlexbox(null)).toBe(false)
  })
})

test('applyFlexbox of no frames is empty', () => {
  expect(applyFlexbox([], flexbox({}), rect(100))).toEqual([])
})

describe('direction', () => {
  test(
    ...c(
      flexbox({ direction: direction.row }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 100), rect(200, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, 100, 100), rect(0, 200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.rowReverse }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(900, 0, 100), rect(800, 0, 100), rect(700, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.columnReverse }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(0, 900, 100), rect(0, 800, 100), rect(0, 700, 100)],
    ),
  )
})

describe('wrap', () => {
  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.nowrap }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 100), rect(200, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.wrap }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, 100, 100), rect(0, 200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.wrapReverse }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, -100, 100), rect(0, -200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, wrap: wrap.nowrap }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, 100, 100), rect(0, 200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, wrap: wrap.wrap }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 100), rect(200, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, wrap: wrap.wrapReverse }),
      rect(100),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(-100, 0, 100), rect(-200, 0, 100)],
    ),
  )

  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.wrap }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 100), rect(0, 100, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.wrapReverse }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(0, 100, 100), rect(100, 100, 100), rect(0, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, wrap: wrap.wrap }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, 100, 100), rect(100, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, wrap: wrap.wrapReverse }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(100, 0, 100), rect(100, 100, 100), rect(0, 0, 100)],
    ),
  )

  test(
    ...c(
      flexbox({ direction: direction.row, wrap: wrap.wrap }),
      rect(300),
      [square(100), rectangle(200, 100), rectangle(200, 100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 200, 100), rect(0, 100, 200, 100), rect(200, 100, 100)],
    ),
  )
})

describe('reverse and wrap combined', () => {
  test(
    ...c(
      flexbox({ direction: direction.rowReverse, wrap: wrap.wrap }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(100, 0, 100), rect(0, 0, 100), rect(100, 100, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.rowReverse, wrap: wrap.wrapReverse }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(100, 100, 100), rect(0, 100, 100), rect(100, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.columnReverse, wrap: wrap.wrap }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(0, 100, 100), rect(0, 0, 100), rect(100, 100, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.columnReverse, wrap: wrap.wrapReverse }),
      rect(200),
      [square(100), square(100), square(100)],
      [rect(100, 100, 100), rect(100, 0, 100), rect(0, 100, 100)],
    ),
  )
})

describe('gap', () => {
  test(
    ...c(
      flexbox({ direction: direction.row, columnGap: 10 }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(110, 0, 100), rect(220, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.column, rowGap: 10 }),
      rect(1000),
      [square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(0, 110, 100), rect(0, 220, 100)],
    ),
  )

  test(
    ...c(
      flexbox({ direction: direction.row, columnGap: 10, wrap: wrap.wrap }),
      rect(210),
      [square(100), square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(110, 0, 100), rect(0, 100, 100), rect(110, 100, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.row, rowGap: 10, wrap: wrap.wrap }),
      rect(210),
      [square(100), square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(100, 0, 100), rect(0, 110, 100), rect(100, 110, 100)],
    ),
  )
  test(
    ...c(
      flexbox({
        direction: direction.row,
        columnGap: 10,
        rowGap: 10,
        wrap: wrap.wrap,
      }),
      rect(210),
      [square(100), square(100), square(100), square(100)],
      [rect(0, 0, 100), rect(110, 0, 100), rect(0, 110, 100), rect(110, 110, 100)],
    ),
  )
})

describe('grow and shrink', () => {
  test(
    ...c(
      flexbox({}),
      rect(400, 100),
      [frame({ width: 100, height: 100, grow: 1 }), frame({ width: 100, height: 100, grow: 1 })],
      [rect(0, 0, 200, 100), rect(200, 0, 200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({}),
      rect(400, 100),
      [frame({ grow: 1, height: 100 }), frame({ grow: 1, height: 100 })],
      [rect(0, 0, 200, 100), rect(200, 0, 200, 100)],
    ),
  )
  test(
    ...c(
      flexbox({}),
      rect(100, 50),
      [frame({ width: 100, height: 50, shrink: 1 }), frame({ width: 100, height: 50, shrink: 1 })],
      [rect(0, 0, 50, 50), rect(50, 0, 50, 50)],
    ),
  )

  test('frames without grow keep their basis', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 100 }), frame({ width: 100, height: 100, grow: 1 })],
        flexbox({}),
        rect(400, 100),
      ),
    ).toEqual([rect(0, 0, 100, 100), rect(100, 0, 300, 100)])
  })
})

describe('min and max constraints', () => {
  test('maxWidth caps growth; the remainder goes to unconstrained items', () => {
    expect(
      applyFlexbox(
        [
          frame({ width: 100, height: 100, grow: 1, maxWidth: 120 }),
          frame({ width: 100, height: 100, grow: 1 }),
        ],
        flexbox({}),
        rect(400, 100),
      ),
    ).toEqual([rect(0, 0, 120, 100), rect(120, 0, 280, 100)])
  })

  test('minWidth floors shrinkage; the excess comes from unconstrained items', () => {
    expect(
      applyFlexbox(
        [
          frame({ width: 100, height: 50, shrink: 1, minWidth: 80 }),
          frame({ width: 100, height: 50, shrink: 1 }),
        ],
        flexbox({}),
        rect(100, 50),
      ),
    ).toEqual([rect(0, 0, 80, 50), rect(80, 0, 20, 50)])
  })

  test('maxHeight caps inherited stretch', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 50, maxHeight: 120 })],
        flexbox({ stretchItems: 1 }),
        rect(300, 200),
      ),
    ).toEqual([rect(0, 0, 100, 120)])
  })
})

describe('offsets', () => {
  test(
    ...c(
      flexbox({}),
      rect(1000),
      [frame({ width: 100, height: 100, offsetLeft: 10, offsetRight: 20 }), square(100)],
      [rect(10, 0, 100), rect(130, 0, 100)],
    ),
  )
  test(
    ...c(
      flexbox({}),
      rect(300),
      [frame({ width: 100, height: 100, offsetTop: 25 })],
      [rect(0, 25, 100)],
    ),
  )
  test(
    ...c(
      flexbox({ alignItems: 1 }),
      rect(300),
      [frame({ width: 100, height: 100, offsetBottom: 10 })],
      [rect(0, 190, 100)],
    ),
  )
})

describe('auto margin offsets', () => {
  test('an auto cross-start offset pushes the item to the cross end', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 100, offsetTop: Number.POSITIVE_INFINITY })],
        flexbox({}),
        rect(300),
      ),
    ).toEqual([rect(0, 200, 100)])
  })

  test('auto offsets on both cross sides center the item', () => {
    expect(
      applyFlexbox(
        [
          frame({
            width: 100,
            height: 100,
            offsetTop: Number.POSITIVE_INFINITY,
            offsetBottom: Number.POSITIVE_INFINITY,
          }),
        ],
        flexbox({}),
        rect(300),
      ),
    ).toEqual([rect(0, 100, 100)])
  })

  test('auto cross offsets defeat inherited stretch', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 100, offsetTop: Number.POSITIVE_INFINITY })],
        flexbox({ stretchItems: 1 }),
        rect(300),
      ),
    ).toEqual([rect(0, 200, 100)])
  })

  test('an auto main-start offset pushes the item to the main end (regression)', () => {
    // The sequence walkers used to add the raw Infinity sentinel instead of
    // the definite offset, producing Infinity positions.
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 100, offsetLeft: Number.POSITIVE_INFINITY })],
        flexbox({}),
        rect(300),
      ),
    ).toEqual([rect(200, 0, 100)])
  })

  test('auto offsets on both main sides center the item', () => {
    expect(
      applyFlexbox(
        [
          frame({
            width: 100,
            height: 100,
            offsetLeft: Number.POSITIVE_INFINITY,
            offsetRight: Number.POSITIVE_INFINITY,
          }),
        ],
        flexbox({}),
        rect(300),
      ),
    ).toEqual([rect(100, 0, 100)])
  })

  test('auto main offsets split free space between items', () => {
    expect(
      applyFlexbox(
        [
          frame({ width: 100, height: 100, offsetRight: Number.POSITIVE_INFINITY }),
          frame({ width: 100, height: 100, offsetLeft: Number.POSITIVE_INFINITY }),
        ],
        flexbox({}),
        rect(500, 100),
      ),
    ).toEqual([rect(0, 0, 100), rect(400, 0, 100)])
  })
})

describe('stretchItems', () => {
  test('stretches items that do not set their own stretch', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 50 }), frame({ width: 100, height: 80 })],
        flexbox({ stretchItems: 1 }),
        rect(300, 200),
      ),
    ).toEqual([rect(0, 0, 100, 200), rect(100, 0, 100, 200)])
  })

  test('a frame stretch of 0 overrides the container', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 50, stretch: 0 }), frame({ width: 100, height: 50 })],
        flexbox({ stretchItems: 1 }),
        rect(300, 200),
      ),
    ).toEqual([rect(0, 0, 100, 50), rect(100, 0, 100, 200)])
  })

  test('fractional stretchItems is inherited as-is', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 50 })],
        flexbox({ stretchItems: 0.5 }),
        rect(300, 200),
      ),
    ).toEqual([rect(0, 0, 100, 125)])
  })

  test('a frame stretch applies without any container stretchItems', () => {
    expect(
      applyFlexbox(
        [frame({ width: 100, height: 50, stretch: 1 }), frame({ width: 100, height: 50 })],
        flexbox({}),
        rect(300, 200),
      ),
    ).toEqual([rect(0, 0, 100, 200), rect(100, 0, 100, 50)])
  })

  test('by default nothing stretches', () => {
    expect(applyFlexbox([frame({ width: 100, height: 50 })], flexbox({}), rect(300, 200))).toEqual([
      rect(0, 0, 100, 50),
    ])
  })
})

test(
  ...c(
    flexbox({
      direction: direction.row,
      columnGap: 10,
      rowGap: 10,
      wrap: wrap.wrap,
      alignItems: 0.5,
      alignContent: 0.5,
      justifyContent: 0.5,
    }),
    rect(1000),
    Array.from({ length: 10 }, () => square(100)),
    [
      rect(10, 395, 100),
      rect(120, 395, 100),
      rect(230, 395, 100),
      rect(340, 395, 100),
      rect(450, 395, 100),
      rect(560, 395, 100),
      rect(670, 395, 100),
      rect(780, 395, 100),
      rect(890, 395, 100),
      rect(450, 505, 100),
    ],
  ),
)

test(
  ...c(
    flexbox({
      direction: direction.row,
      columnGap: 10,
      rowGap: 10,
      wrap: wrap.wrap,
      alignItems: 0.5,
      alignContent: 0.5,
      justifyContent: 0.5,
    }),
    rect(1000),
    Array.from({ length: 9 }, () => square(100)),
    [
      rect(10, 450, 100),
      rect(120, 450, 100),
      rect(230, 450, 100),
      rect(340, 450, 100),
      rect(450, 450, 100),
      rect(560, 450, 100),
      rect(670, 450, 100),
      rect(780, 450, 100),
      rect(890, 450, 100),
    ],
  ),
)

test(
  ...c(
    flexbox({
      direction: direction.row,
      wrap: wrap.wrap,
    }),
    rect(10, 10, 1000),
    [square(100), square(100), square(100), square(100)],
    [rect(10, 10, 100), rect(110, 10, 100), rect(210, 10, 100), rect(310, 10, 100)],
  ),
)

describe('serialization', () => {
  test('toJSON emits the configuration', () => {
    expect(JSON.parse(JSON.stringify(flexbox({ direction: direction.column, rowGap: 5 })))).toEqual(
      {
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
      },
    )
  })
})
