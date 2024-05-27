<template>
  <RootFrame aspect-ratio="16/9" fit="cover">
    <FlexFrame
      width="100%"
      height="100%"
      gap="10px"
      flex-direction="row"
      flex-wrap="wrap"
    >
      <FlexFrame
        width="100px"
        height="100px"
        grow="1"
        stroke-width="3px"
        stroke="black"
        min-width="600px"
      />
      <AbsoluteFrame width="200px" height="100px">
        <AbsoluteFrame width="100%" height="100%" fill="blue" />
        <GraphicText width="200px" height="100px">Hello World</GraphicText>
      </AbsoluteFrame>
    </FlexFrame>
  </RootFrame>
</template>

<script setup lang="ts">
const show = ref(false)

onMounted(() => {
  setInterval(() => {
    show.value = !show.value
  }, 2000)
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
svg,
body,
html {
  width: 100dvw;
  height: 100dvh;
}
</style>
