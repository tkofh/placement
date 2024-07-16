<template>
  <GraphicRoot size="fill">
    <rect x="0" y="0" width="100" height="100" fill="red" />
  </GraphicRoot>
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
