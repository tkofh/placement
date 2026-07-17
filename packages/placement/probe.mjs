import { frame } from './src/frame.ts'
import { applyFlexbox, flexbox, direction } from './src/internal/flexbox.ts'
import { rect } from './src/rect.ts'

// Scenario from the finding: column-reverse container 200x100,
// item 50x20 with offsetTop=10 (what FlexItem margin-top="10" produces).
const parent = rect(0, 0, 200, 100)

const itemColRev = frame({ width: 50, height: 20, offsetTop: 10 })
const outColRev = applyFlexbox(
  [itemColRev],
  flexbox({ direction: direction.columnReverse }),
  parent,
)
console.log('column-reverse, offsetTop=10 :', outColRev[0].toJSON())

const itemColRevBottom = frame({ width: 50, height: 20, offsetBottom: 10 })
const outColRevBottom = applyFlexbox(
  [itemColRevBottom],
  flexbox({ direction: direction.columnReverse }),
  parent,
)
console.log('column-reverse, offsetBottom=10:', outColRevBottom[0].toJSON())

// row-reverse with offsetLeft=10
const itemRowRev = frame({ width: 50, height: 20, offsetLeft: 10 })
const outRowRev = applyFlexbox([itemRowRev], flexbox({ direction: direction.rowReverse }), parent)
console.log('row-reverse, offsetLeft=10  :', outRowRev[0].toJSON())

// sanity: plain column, offsetTop=10 -> y should be 10
const itemCol = frame({ width: 50, height: 20, offsetTop: 10 })
const outCol = applyFlexbox([itemCol], flexbox({ direction: direction.column }), parent)
console.log('column, offsetTop=10        :', outCol[0].toJSON())

// two items in column-reverse to see neighbor separation semantics
const a = frame({ width: 50, height: 20, offsetTop: 10 })
const b = frame({ width: 50, height: 20 })
const outTwo = applyFlexbox([a, b], flexbox({ direction: direction.columnReverse }), parent)
console.log(
  'column-reverse two items, first has offsetTop=10:',
  outTwo.map((r) => r.toJSON()),
)
