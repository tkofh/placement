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
import { Graphic, GraphicFrame } from '../../placement/src/graphic'

const graphic = new Graphic({ width: 100, height: 100 })

console.log('------------------------------------------')
console.log('appending child')
console.log('------------------------------------------')
const graphicFrame = graphic.appendChild(
  new GraphicFrame({ width: 100, height: 100 }),
)

console.log('------------------------------------------')
console.log('resizing')
console.log('------------------------------------------')
graphic.resize(200, 200)

console.log('------------------------------------------')
console.log('setting size')
console.log('------------------------------------------')

graphicFrame.width = '100%'
graphicFrame.height = '100%'
console.log({
  width: graphicFrame.computedWidth,
  height: graphicFrame.computedHeight,
})

console.log({
  width: graphicFrame.parent!.computedWidth,
  height: graphicFrame.parent!.computedHeight,
})

console.log({
  width: graphicFrame.computedWidth,
  height: graphicFrame.computedHeight,
})

console.log(graphicFrame)
console.log(graphic)
</script>
