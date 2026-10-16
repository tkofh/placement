<template>
  <NuxtPage />
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
}
svg,
body,
html {
  display: block;
  width: 100dvw;
  height: 100dvh;
  background: color(display-p3 0.045 0.055 0.1);
}
svg text {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  fill: color(display-p3 0.88 0.9 0.96);
}
svg text.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
svg text.label {
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.55;
}
svg text.value {
  font-size: 11px;
  font-weight: 600;
}
</style>
