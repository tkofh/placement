<template>
<RootFrame fit="contain" max-width="1600" @click="show=!show">
  <FlexFrame
      width="100%"
      height="100%"
      fill="#ccc"
      gap="20px"
      flex-wrap="wrap"
      inset="20px"
      flex-direction="row"
      align-items="0.5"
      align-content="0.5"
  >
    <BasicFrame width="300" height="400" #default="rect">
      <rect v-bind="rect" fill="#333" />
      <text :x="rect.x" :y="rect.y" fill="white">1</text>
    </BasicFrame>
    <BasicFrame v-if="show" width="300" height="400" grow="1" #default="rect">
      <rect v-bind="rect" fill="#333" />
      <text :x="rect.x" :y="rect.y" fill="white">2</text>
    </BasicFrame>
    <BasicFrame width="300" height="400" #default="rect">
      <rect v-bind="rect" fill="#333" />
      <text :x="rect.x" :y="rect.y" fill="white">3</text>
    </BasicFrame>
  </FlexFrame>
</RootFrame>
</template>

<script setup lang="ts">
const _show = ref(true)
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
svg, body, html {
  overflow: clip;
  width: 100dvw;
  height: 100dvh;
}
</style>
