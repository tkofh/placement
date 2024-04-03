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
import { Graphic, GraphicFrame } from '../../placement/src/gom3'

const graphic = new Graphic({ width: 1600, height: 900 })

const other = graphic.appendChild(
  new GraphicFrame({ top: 50, left: 100, width: '1fr', height: '1fr' }),
)

console.log(other, other.computedWidth, other.computedHeight)
</script>
