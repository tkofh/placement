import { bench, describe } from 'vitest'
import { applyFlexbox, direction, flexbox, wrap } from '../src/flexbox.ts'
import { type Frame, frame } from '../src/frame.ts'
import { rect } from '../src/rect.ts'

// Deterministic size cycles stand in for varied content; no randomness, so
// runs are comparable.
const widths = [100, 60, 140, 80, 120, 90, 110, 70, 130, 50] as const
const heights = [80, 120, 60, 100, 90, 70, 110, 130, 50, 140] as const

const makeFrames = (count: number): ReadonlyArray<Frame> =>
  Array.from({ length: count }, (_, index) =>
    frame({
      width: widths[index % widths.length] as number,
      height: heights[index % heights.length] as number,
      grow: index % 3,
      shrink: index % 2,
    }),
  )

const parent = rect(1000)

const nowrapLayout = flexbox({
  direction: direction.row,
  wrap: wrap.nowrap,
  columnGap: 10,
  justifyContent: 0.5,
})

const wrapLayout = flexbox({
  direction: direction.row,
  wrap: wrap.wrap,
  columnGap: 10,
  rowGap: 10,
  justifyContent: 0.5,
  alignItems: 0.5,
  alignContent: 0.5,
  stretchItems: 0.5,
})

for (const count of [10, 100, 1000]) {
  const frames = makeFrames(count)

  describe(`${count} items`, () => {
    bench('nowrap', () => {
      applyFlexbox(frames, nowrapLayout, parent)
    })

    bench('wrap', () => {
      applyFlexbox(frames, wrapLayout, parent)
    })
  })
}
