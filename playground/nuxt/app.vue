<template>
  <GraphicRoot
    width="100%"
    height="100%"
    fit="contain"
    origin="center"
    debug-groups
  >
    <FlexLayout flow="row nowrap" gap="10px" align-items="end">
      <FlexItem height="100%" width="100px">
        <FlexLayout flow="column-reverse">
          <FlexItem width="100%" height="40px">
            <GraphicRect fill="grey" r="10px" />
            <GraphicText
              top="50%"
              left="50%"
              origin="center"
              style="line-height: 1cap"
              y="-3.5px"
            >
              January
            </GraphicText>
          </FlexItem>
          <FlexItem width="100%" :height="valueA * 50 + valueB * 0.5">
            <GraphicRect fill="blue" />
          </FlexItem>
        </FlexLayout>
      </FlexItem>

      <FlexItem height="100%" width="100px">
        <FlexLayout flow="column-reverse">
          <FlexItem width="100%" height="40px">
            <GraphicRect fill="grey" r="10px" />
            <GraphicText
              top="50%"
              left="50%"
              origin="center"
              style="line-height: 1cap"
              y="-3.5px"
            >
              February
            </GraphicText>
          </FlexItem>
          <FlexItem width="100%" height="500px">
            <GraphicRect fill="blue" />
          </FlexItem>
        </FlexLayout>
      </FlexItem>

      <FlexItem height="100%" width="100px">
        <FlexLayout flow="column-reverse">
          <FlexItem width="100%" :height="valueB" :margin-top="valueB - 40">
            <GraphicRect fill="grey" r="10px" />
            <GraphicText
              top="50%"
              left="50%"
              origin="center"
              style="line-height: 1cap"
              y="-3.5px"
            >
              March
            </GraphicText>
          </FlexItem>
          <FlexItem width="100%" height="300px">
            <GraphicRect fill="blue" />
          </FlexItem>
          <FlexItem width="100%" grow="1">
            <GraphicGroup left="20px" debug>
              <GraphicLine stroke="5px pink">
                <GraphicPoint x="0" y="0" />
                <GraphicPoint x="100%" y="100%" />
              </GraphicLine>
              <FlexLayout
                gutter-top="10px"
                gutter-right="10px"
                gutter-bottom="10px"
                gutter-left="10px"
                flow="column nowrap"
                align-items="center"
              >
                <FlexItem width="100%" height="4px">
                  <GraphicRect fill="purple" />
                </FlexItem>
                <FlexItem width="4px" height="auto" grow="1">
                  <GraphicRect fill="purple" />
                </FlexItem>
                <FlexItem width="100%" height="4px">
                  <GraphicRect fill="purple" />
                </FlexItem>
              </FlexLayout>
            </GraphicGroup>
          </FlexItem>
        </FlexLayout>
      </FlexItem>
    </FlexLayout>

    <!--    <FlexLayout flow="row" justify-content="place 0 space 1 0" debug>-->
    <!--      <FlexItem size="1 / 1 width 100">-->
    <!--        <GraphicRect fill="black" />-->
    <!--      </FlexItem>-->
    <!--      <FlexItem size="1 / 1 width 100">-->
    <!--        <GraphicRect fill="black" />-->
    <!--      </FlexItem>-->
    <!--    </FlexLayout>-->

    <!--    <GraphicGroup>-->
    <!--      <GraphicLine class="foo">-->
    <!--        <GraphicPoint x="0" y="0" />-->
    <!--        <GraphicPoint x="0" y="100" />-->
    <!--      </GraphicLine>-->
    <!--    </GraphicGroup>-->
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

const show = ref(false)

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
