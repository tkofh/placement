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
.controls {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: max-content;
  max-width: calc(100vw - 32px);
  gap: 6px;
  align-items: center;
  font: 11px ui-monospace, 'SF Mono', Menlo, monospace;
}
.controls span {
  width: 10px;
}
.controls button,
.controls a {
  font: inherit;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid color(srgb 1 1 1 / 0.15);
  background: color(srgb 1 1 1 / 0.04);
  color: color(display-p3 0.88 0.9 0.96);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}
.controls button.on {
  background: color(display-p3 0.35 0.55 1 / 0.35);
  border-color: color(display-p3 0.35 0.55 1 / 0.7);
}
</style>
