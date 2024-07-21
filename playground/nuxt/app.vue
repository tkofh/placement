<template>
  <GraphicRoot size="fill" fit="contain" origin="center">
    <FlexLayout
      flow="row wrap"
      :gap="value"
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
          :fill="`rgb(255 0 0 / ${remap(i, 1, count, 10, 100)}%)`"
          opacity="0.5"
        />
      </FlexItem>
    </FlexLayout>

    <GraphicRect
      inset="top 50% right 10px"
      size="100px 25%"
      fill="none"
      stroke="black 10px dashed 4 2 5 7"
    />
  </GraphicRoot>
</template>

<script setup lang="ts">
import { useSpring } from '@coily/vue'
import { remap } from 'placement/utils'

const count = 30

const animate = ref(true)
const isLeft = ref(false)

const { value } = useSpring(() => (isLeft.value ? 10 : 20), {
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
