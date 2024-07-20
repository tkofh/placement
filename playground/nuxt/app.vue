<template>
  <GraphicRoot size="fill" fit="contain" origin="center">
    <FlexLayout
      flow="row wrap"
      gap="10px"
      place="center"
      size="fill"
      gutter="10px"
    >
      <FlexItem
        v-for="i in count"
        :key="`item-${i}`"
        width="100px"
        height="100px"
      >
        <GraphicRect
          size="fill"
          r="1vmin"
          :fill="`rgba(255,0,0, ${remap(i, 0, count - 1, 0.1, 1)})`"
        />
      </FlexItem>
    </FlexLayout>

    <GraphicRect top="50%" right="10px" width="100px" height="25%" fill="red" />
  </GraphicRoot>
</template>

<script setup lang="ts">
import { useSpring } from '@coily/vue'
import { remap } from 'placement/utils'

const count = 3

const animate = ref(true)
const isLeft = ref(false)

const { value } = useSpring(() => (isLeft.value ? 100 : 600), {
  tension: 100,
  damping: 10,
  mass: 1,
  precision: 2,
})

onMounted(() => {
  let ival: number | null = null

  watchEffect(() => {
    if (animate.value) {
      ival = window.setInterval(() => {
        isLeft.value = !isLeft.value
      }, 2000)
    } else if (ival) {
      window.clearInterval(ival)
    }
  })
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  offset: 0;
}
svg,
body,
html {
  display: block;
  width: 100dvw;
  height: 100dvh;
}
</style>
