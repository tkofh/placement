import { inspect } from 'node:util'
import { describe, expect, test } from 'vitest'
import {
  type Flexbox,
  applyFlexbox,
  direction,
  flexbox,
  wrap,
} from '../src/flexbox'
import { type Frame, frame } from '../src/frame'
import { type Rect, rect } from '../src/rect'

function c(
  layout: Flexbox,
  parent: Rect,
  frames: ReadonlyArray<Frame>,
  rects: ReadonlyArray<Rect>,
  log = false,
): [string, () => void] {
  return [
    `[${frames.map((frame) => inspect(frame)).join(', ')}]: ${inspect(layout)}: ${inspect(parent)}: ${inspect(
      rects,
    )}`,
    () => {
      if (log) {
        console.log({
          frames,
          layout,
          parent,
          rects,
        })
      }
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
      [
        rect(0, 0, 100),
        rect(100, 0, 200, 100),
        rect(0, 100, 200, 100),
        rect(200, 100, 100),
      ],
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
      [
        rect(0, 0, 100),
        rect(110, 0, 100),
        rect(0, 100, 100),
        rect(110, 100, 100),
      ],
    ),
  )
  test(
    ...c(
      flexbox({ direction: direction.row, rowGap: 10, wrap: wrap.wrap }),
      rect(210),
      [square(100), square(100), square(100), square(100)],
      [
        rect(0, 0, 100),
        rect(100, 0, 100),
        rect(0, 110, 100),
        rect(100, 110, 100),
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
      }),
      rect(210),
      [square(100), square(100), square(100), square(100)],
      [
        rect(0, 0, 100),
        rect(110, 0, 100),
        rect(0, 110, 100),
        rect(110, 110, 100),
      ],
    ),
  )
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
    [
      rect(10, 10, 100),
      rect(110, 10, 100),
      rect(210, 10, 100),
      rect(310, 10, 100),
    ],
  ),
)
