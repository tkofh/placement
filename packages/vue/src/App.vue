<template>
  <!-- <GraphicRoot width="1000" height="1000" fit="contain"> -->
  <!-- <GraphicPolarProjection layer origin="50%" theta="0deg"> -->

  <!-- <GraphicFlexPlacement direction="column">
      <GraphicRect height="50" width="0" grow="20"></GraphicRect>
      <GraphicRect height="50" width="0" grow="2"></GraphicRect>
      <GraphicRect height="50" width="0" grow="6"></GraphicRect>
      <GraphicRect height="50" width="0" grow="30"></GraphicRect>
    </GraphicFlexPlacement> -->

  <!-- </GraphicPolarProjection> -->

  <!-- <GraphicCircle layer top="50%" left="50%" origin="50%" radius="100" /> -->
  <!-- </GraphicRoot> -->
  <p>hello</p>
</template>

<script lang="ts" setup>
import { FlexFrame } from 'placement/src/FlexFrame.ts'
import { Frame } from 'placement/src/Frame.ts'

const layout = new FlexFrame(
  {
    width: 200,
    height: 200,
  },
  {
    direction: 'row',
    wrap: true,
  },
)

const child1 = layout.appendChild(new Frame({ width: 50, height: 50, grow: 1 }))
const child2 = layout.appendChild(new Frame({ width: 50, height: 50, grow: 1 }))
console.log(layout, child1, child2)
</script>
