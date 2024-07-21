<template>
  <GraphicRoot size="fill" fit="contain" origin="center">
    <GraphicRect size="fill" fill="color(display-p3 0.008 0.008 0.165 / 0.15)" />
    <FlexLayout
      size="fill"
      flow="row nowrap"
      justify-content="center"
      :align-items="`place ${valueC}%`"
      :gap="`${valueA}vmin`"
    >
      <template v-for="i in count" :key="`item-${i}`">
        <FlexItem :size="`${valueD}vw ${valueB}vh`">
          <GraphicRect size="fill" r="1vmin" fill="color(display-p3 0.298 0 0.639 / 0.683)" />
          <GraphicRect size="50%" inset="50%" origin="50%" r="1vmin" fill="color(display-p3 0.298 0 0.639 / 0.683)" />
        </FlexItem>
      </template>
    </FlexLayout>
    <FlexLayout
      size="fill"
      flow="column nowrap"
      justify-content="center"
      :align-items="`place ${valueC}%`"
      :gap="`${valueA}vmin`"
    >
      <template v-for="i in count" :key="`item-${i}`">
        <FlexItem :size="`${valueB}vw ${valueD}vh`">
          <GraphicRect size="fill" r="1vmin" fill="color(display-p3 0 0.482 0.675 / 0.718)" />
          <GraphicRect inset="2vmin" r="1vmin" fill="color(display-p3 0 0.482 0.675 / 0.718)" />
        </FlexItem>
      </template>
    </FlexLayout>
  </GraphicRoot>
</template>

<script setup lang="ts">
import { useSpring } from '@coily/vue'

const count = 5

const toggleA = ref(false)
const toggleB = ref(false)
const toggleC = ref(false)
const toggleD = ref(false)

const { value: valueA } = useSpring(() => (toggleA.value ? 2 : 8), {
  tension: 120,
  damping: 20,
  mass: 1,
  precision: 2,
})

const { value: valueB } = useSpring(() => (toggleB.value ? 40 : 70), {
  tension: 120,
  damping: 20,
  mass: 1,
  precision: 2,
})

const { value: valueC } = useSpring(() => (toggleC.value ? 0 : 100), {
  tension: 50,
  damping: 40,
  mass: 0.5,
  precision: 8,
})

const { value: valueD } = useSpring(() => (toggleD.value ? 6 : 8), {
  tension: 200,
  damping: 40,
  mass: 1.5,
  precision: 8,
})

onMounted(() => {
  setInterval(() => {
    toggleA.value = !toggleA.value
  }, 2300)

  setInterval(() => {
    toggleB.value = !toggleB.value
  }, 1500)

  setInterval(() => {
    toggleC.value = !toggleC.value
  }, 4000)

  setInterval(() => {
    toggleD.value = !toggleD.value
  }, 3400)
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
