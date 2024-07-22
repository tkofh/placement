<template>
  <GraphicRoot size="fill" fit="contain" origin="center">
    <GraphicRect
      size="fill"
      fill="color(display-p3 0.012 0.012 0.184 / 0.091)"
    />
    <GraphicCircle
      inset="top 50% left 50%"
      r="30vmin"
      fill="none"
      stroke="color(display-p3 0.008 0.027 0.184 / 0.197) 10px dashed 10 5"
    />
    <GraphicCircle
      inset="top 50% left 50%"
      r="30vmax"
      fill="none"
      stroke="color(display-p3 0.008 0.027 0.184 / 0.197) 10px dashed 10 5"
    />
    <template v-for="item of layers" :key="item[0]">
      <FlexLayout
        size="fill"
        :flow="item[0]"
        justify-content="center"
        :align-items="`place ${valueC}%`"
        :gap="`${valueA}vmin`"
      >
        <template v-for="i in count" :key="`item-${i}`">
          <FlexItem
            :size="
              item[2] ? `${valueB}vw ${valueD}vh` : `${valueD}vw ${valueB}vh`
            "
          >
            <GraphicRect size="fill" r="1vmin" :fill="item[1]" />
          </FlexItem>
        </template>
      </FlexLayout>
    </template>
  </GraphicRoot>
</template>

<script setup lang="ts">
import { useSpring } from '@coily/vue'

const count = 5

const layers = [
  ['row nowrap', 'color(display-p3 0.298 0 0.639 / 0.683)', false],
  ['column nowrap', 'color(display-p3 0 0.482 0.675 / 0.718)', true],
] as const

const toggleA = ref(false)
const toggleB = ref(false)
const toggleC = ref(false)
const toggleD = ref(false)

const timeScale = 1

const delayA = 1101 * timeScale
const delayB = 2022 * timeScale
const delayC = 3303 * timeScale
const delayD = 5055 * timeScale

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
  let mounted = false
  setInterval(() => {
    if (!mounted) return
    toggleA.value = !toggleA.value
  }, delayA)

  setInterval(() => {
    if (!mounted) return
    toggleB.value = !toggleB.value
  }, delayB)

  setInterval(() => {
    if (!mounted) return
    toggleC.value = !toggleC.value
  }, delayC)

  setInterval(() => {
    if (!mounted) return
    toggleD.value = !toggleD.value
  }, delayD)

  mounted = true
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
