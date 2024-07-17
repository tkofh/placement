<template>
  <GraphicRoot size="1000px" fit="contain" origin="center">
    <rect x="0" y="0" width="1000" height="1000" fill="#faa" />
  </GraphicRoot>
</template>

<script setup lang="ts">
// import { useSpring } from "@coily/vue";
//
// const animate = ref(true);
// const isLeft = ref(false);
//
// const { value } = useSpring(() => (isLeft.value ? 0 : 100), {
//   tension: 100,
//   damping: 20,
//   mass: 1,
//   precision: 2,
// });
//
// onMounted(() => {
//   let ival: number | null = null;
//
//   watchEffect(() => {
//     if (animate.value) {
//       ival = window.setInterval(() => {
//         isLeft.value = !isLeft.value;
//       }, 2000);
//     } else {
//       if (ival) {
//         window.clearInterval(ival);
//       }
//     }
//   });
// });
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
  display: block;
  width: 100dvw;
  height: 100dvh;
}
</style>
