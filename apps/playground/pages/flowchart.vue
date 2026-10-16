<template>
  <GraphicRoot :width="root.width" :height="root.height" fit="contain" origin="center">
    <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" />
    <GraphicText left="24px" top="16px" class="title">FLOWCHART</GraphicText>
    <GraphicText right="24px" top="20px" class="label">
      {{ direction.toUpperCase() }} / {{ backEdges.toUpperCase() }}
    </GraphicText>

    <HierarchyLayout
      left="50%"
      top="50%"
      origin="center"
      :direction="direction"
      :back-edges="backEdges"
      rank-gap="30px"
      node-gap="28px"
      edge-gap="10px"
    >
      <!-- edges first, so nodes paint over their ends -->
      <HierarchyEdge
        v-for="edge in edges"
        :key="`${edge.from}-${edge.to}`"
        :from="edge.from"
        :to="edge.to"
        :r="smooth ? '12px' : '0px'"
        :min-r="smooth ? '6px' : '0px'"
        :smoothing="smooth ? 0.8 : 0"
        stroke="color(srgb 1 1 1 / 0.45) 1.5px"
      >
        <!-- the left margin trails the arrow, so the line runs straight past it -->
        <HierarchyAdornment at="end" width="9px" height="8px" margin-left="4px">
          <!-- a third of the way along, a triangle's corners point right -->
          <GraphicPolygon
            sides="3"
            :phase="1 / 3"
            :r="smooth ? '1.5px' : '0px'"
            fill="color(srgb 1 1 1 / 0.55)"
          />
        </HierarchyAdornment>
        <HierarchyAdornment v-if="edge.label" width="34px" height="18px">
          <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" r="4px" />
          <GraphicText left="50%" top="50%" origin="center" class="edge-label">
            {{ edge.label }}
          </GraphicText>
        </HierarchyAdornment>
      </HierarchyEdge>

      <HierarchyNode
        v-for="node in nodes"
        :id="node.id"
        :key="node.id"
        :width="node.kind === 'decision' ? '92px' : '124px'"
        :height="node.kind === 'decision' ? '56px' : '34px'"
      >
        <!-- the graphic that fills a node is the outline its edges meet -->
        <GraphicPolygon
          v-if="node.kind === 'decision'"
          phase="0.5"
          :r="radius(node.kind)"
          :smoothing="smooth ? 0.8 : 0"
          :fill="node.fill"
          stroke="color(srgb 1 1 1 / 0.25) 1px"
        />
        <GraphicRect
          v-else
          :fill="node.fill"
          :r="radius(node.kind)"
          :smoothing="smooth && node.kind !== 'terminal' ? 0.8 : 0"
          stroke="color(srgb 1 1 1 / 0.25) 1px"
        />
        <GraphicText left="50%" top="50%" origin="center" class="node">
          {{ node.text }}
        </GraphicText>
      </HierarchyNode>
    </HierarchyLayout>
  </GraphicRoot>

  <nav class="controls">
    <button v-for="d in DIRECTIONS" :key="d" :class="{ on: d === direction }" @click="direction = d">
      {{ d }}
    </button>
    <span />
    <button
      v-for="b in BACK_EDGES"
      :key="b"
      :class="{ on: b === backEdges }"
      @click="backEdges = b"
    >
      back {{ b }}
    </button>
    <span />
    <button :class="{ on: smooth }" @click="smooth = !smooth">smooth corners</button>
    <button :class="{ on: withLint }" @click="withLint = !withLint">lint step</button>
    <span />
    <NuxtLink to="/">springboard</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const DIRECTIONS = ['down', 'right', 'up', 'left'] as const
const BACK_EDGES = ['direct', 'loop'] as const

const direction = ref<(typeof DIRECTIONS)[number]>('down')
const smooth = ref(true)
const backEdges = ref<(typeof BACK_EDGES)[number]>('loop')
const withLint = ref(false)

// The drawing has its own size, so the scene grows along the flow to fit it.
const root = computed(() =>
  direction.value === 'down' || direction.value === 'up'
    ? { width: '1000px', height: '780px' } as const
    : { width: '1500px', height: '640px' } as const,
)

const PROCESS = 'color(display-p3 0.16 0.22 0.4)'
const DECISION = 'color(display-p3 0.36 0.24 0.12)'
const TERMINAL = 'color(display-p3 0.14 0.34 0.26)'
const ALERT = 'color(display-p3 0.4 0.15 0.2)'

type Kind = 'terminal' | 'process' | 'decision'

// Each node's corner radius. A rounded diamond grows, so its rounded tips
// still touch its box.
const radius = (kind: Kind) =>
  kind === 'terminal' ? '17px' : kind === 'decision' && !smooth.value ? '0px' : '10px'

const nodes = computed(() => {
  const list: Array<{ id: string; text: string; kind: Kind; fill: string }> = [
    { id: 'start', text: 'push', kind: 'terminal', fill: TERMINAL },
    { id: 'fetch', text: 'fetch config', kind: 'process', fill: PROCESS },
    { id: 'valid', text: 'valid?', kind: 'decision', fill: DECISION },
    { id: 'fix', text: 'fix config', kind: 'process', fill: ALERT },
    { id: 'build', text: 'build', kind: 'process', fill: PROCESS },
    { id: 'test', text: 'run tests', kind: 'process', fill: PROCESS },
    { id: 'pass', text: 'pass?', kind: 'decision', fill: DECISION },
    { id: 'deploy', text: 'deploy', kind: 'process', fill: PROCESS },
    { id: 'notify', text: 'notify team', kind: 'process', fill: ALERT },
    { id: 'end', text: 'done', kind: 'terminal', fill: TERMINAL },
  ]
  if (withLint.value) {
    list.splice(5, 0, { id: 'lint', text: 'lint', kind: 'process', fill: PROCESS })
  }
  return list
})

const edges = computed(() => [
  { from: 'start', to: 'fetch' },
  { from: 'fetch', to: 'valid' },
  { from: 'valid', to: 'build', label: 'yes' },
  { from: 'valid', to: 'fix', label: 'no' },
  // A cycle: the solver reverses it internally, and it still routes from fix to fetch.
  { from: 'fix', to: 'fetch' },
  ...(withLint.value
    ? [
        { from: 'build', to: 'lint' },
        { from: 'lint', to: 'test' },
      ]
    : [{ from: 'build', to: 'test' }]),
  { from: 'test', to: 'pass' },
  { from: 'pass', to: 'deploy', label: 'yes' },
  { from: 'pass', to: 'notify', label: 'no' },
  { from: 'deploy', to: 'end' },
  { from: 'notify', to: 'end' },
])
</script>

<style>
svg text.node {
  font-size: 12px;
  font-weight: 600;
}
svg text.edge-label {
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.75;
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
