import { bench } from 'vitest'
import { direction, flexbox, wrap } from '../src/flexbox'
import { applyFlexbox } from '../src/flexbox'
import { frame } from '../src/frame'
import { rect, setSize } from '../src/rect'

const frames = [
  frame({
    width: 100,
    height: 100,
    align: 0,
    justify: 0,
    stretchCross: 1,
  }),
  frame({
    width: 100,
    height: 100,
    align: 0,
    justify: 0,
    stretchCross: 1,
  }),
  frame({
    width: 200,
    height: 50,
    align: 0,
    justify: 0,
    stretchCross: 1,
  }),
  frame({
    width: 200,
    height: 50,
    align: 0,
    justify: 0,
    stretchCross: 1,
  }),
]

let parent = rect(1000)

bench('flexbox', () => {
  const layout = flexbox({
    direction: direction.row,
    wrap: wrap.nowrap,
    alignContent: 0,
    alignItems: 0,
    stretchContent: 1,
    stretchItems: 1,
    justifyContent: 0,
    rowGap: 0,
    columnGap: 0,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
  })

  parent = parent.pipe(
    setSize(parent.width + Math.round(Math.random() * 100) - 25),
  )
  applyFlexbox(frames, layout, parent)
})
