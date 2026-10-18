<template>
  <GraphicRoot width="1000px" height="640px" fit="contain" origin="center">
    <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" />
    <GraphicText left="24px" top="16px" class="title">CONNECTORS</GraphicText>
    <GraphicText right="24px" top="20px" class="label">DRAG THE BOXES</GraphicText>

    <ConnectorLayout
      :clearance="`${clearance}px`"
      :gap="`${gap}px`"
      :bend-cost="bendCost === 'auto' ? undefined : `${bendCost}px`"
      :justify-adornments="justify"
      :jog-at="jogAt"
      :jog-slant="slant"
      :merge="merge"
      :merge-gap="mergeGap === 'gap' ? undefined : `${mergeGap}px`"
    >
      <!-- the pool is a flex row, and each worker's box is a node -->
      <GraphicGroup left="520px" top="478px" width="456px" height="138px">
        <GraphicRect fill="color(srgb 1 1 1 / 0.035)" r="14px" />
        <GraphicText left="16px" top="12px" class="label">WORKERS / flex row</GraphicText>
        <GraphicGroup top="36px" bottom="14px" left="14px" right="14px">
          <FlexLayout justify-content="space-evenly" align-items="center">
            <FlexItem v-for="worker in WORKERS" :key="worker" width="112px" height="36px">
              <ConnectorNode :id="worker">
                <GraphicRect
                  :fill="WORKER"
                  :r="corners ? '10px' : '0px'"
                  :smoothing="corners ? 0.6 : 0"
                  :stroke="stroke(worker)"
                />
                <GraphicText left="50%" top="50%" origin="center" class="node">
                  {{ worker }}
                </GraphicText>
              </ConnectorNode>
            </FlexItem>
          </FlexLayout>
        </GraphicGroup>
      </GraphicGroup>

      <!-- edges first, so nodes paint over their ends -->
      <ConnectorEdge
        v-for="edge in EDGES"
        :key="`${edge.from}-${edge.to}`"
        :from="edge.from"
        :to="edge.to"
        :r="corners ? '10px' : '0px'"
        :smoothing="corners ? 0.6 : 0"
        :stroke="lit(edge) ? 'color(display-p3 0.55 0.75 1 / 0.95) 1.75px' : 'color(srgb 1 1 1 / 0.4) 1.5px'"
        thickness="1.75px"
      >
        <!-- the left margin trails the arrow, so the line runs straight past it -->
        <ConnectorAdornment at="end" width="9px" height="8px" margin-left="4px">
          <GraphicPolygon
            sides="3"
            :phase="1 / 3"
            :r="corners ? '1.5px' : '0px'"
            :fill="lit(edge) ? 'color(display-p3 0.55 0.75 1)' : 'color(srgb 1 1 1 / 0.55)'"
          />
        </ConnectorAdornment>
        <ConnectorAdornment v-if="edge.label" width="40px" height="16px">
          <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" r="4px" />
          <GraphicText left="50%" top="50%" origin="center" class="edge-label">
            {{ edge.label }}
          </GraphicText>
        </ConnectorAdornment>
      </ConnectorEdge>

      <g
        v-for="node in nodes"
        :key="node.id"
        class="drag"
        @pointerdown="grab($event, node)"
        @pointermove="drag($event, node)"
        @pointerup="drop"
        @pointercancel="drop"
        @pointerenter="hovered = node.id"
        @pointerleave="hovered = undefined"
      >
        <ConnectorNode
          :id="node.id"
          :left="`${node.x}px`"
          :top="`${node.y}px`"
          :width="`${node.width}px`"
          :height="`${node.height}px`"
        >
          <GraphicRect
            :fill="node.fill"
            :r="corners ? '10px' : '0px'"
            :smoothing="corners ? 0.6 : 0"
            :stroke="stroke(node.id)"
          />
          <GraphicText left="50%" top="50%" origin="center" class="node">
            {{ node.text }}
          </GraphicText>
        </ConnectorNode>
      </g>
    </ConnectorLayout>
  </GraphicRoot>

  <nav class="controls">
    <button :class="{ on: corners }" @click="corners = !corners">round corners</button>
    <span />
    <button v-for="g in GAPS" :key="g" :class="{ on: g === gap }" @click="gap = g">
      gap {{ g }}
    </button>
    <span />
    <button
      v-for="c in CLEARANCES"
      :key="c"
      :class="{ on: c === clearance }"
      @click="clearance = c"
    >
      clearance {{ c }}
    </button>
    <span />
    <button
      v-for="b in BEND_COSTS"
      :key="b"
      :class="{ on: b === bendCost }"
      @click="bendCost = b"
    >
      bend cost {{ b }}
    </button>
    <span />
    <button v-for="j in JUSTIFY" :key="j" :class="{ on: j === justify }" @click="justify = j">
      labels {{ j }}
    </button>
    <span />
    <button v-for="j in JOGS" :key="j" :class="{ on: j === jogAt }" @click="jogAt = j">
      jog {{ j }}
    </button>
    <span />
    <button v-for="k in SLANTS" :key="k" :class="{ on: k === slant }" @click="slant = k">
      slant {{ k }}
    </button>
    <span />
    <button v-for="m in MERGES" :key="m" :class="{ on: m === merge }" @click="merge = m">
      merge {{ m }}
    </button>
    <button
      v-for="g in MERGE_GAPS"
      :key="g"
      :class="{ on: g === mergeGap }"
      @click="mergeGap = g"
    >
      lanes {{ g }}
    </button>
    <span />
    <button @click="reset">reset</button>
    <button @click="copy">{{ copied ? 'copied' : 'copy state' }}</button>
    <span />
    <NuxtLink to="/flowchart">flowchart</NuxtLink>
    <NuxtLink to="/">springboard</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const GAPS = [4, 8] as const
const CLEARANCES = [16, 28] as const
const BEND_COSTS = ['auto', 0, 40] as const
const JUSTIFY = ['start', 'center', 'end'] as const
const JOGS = ['start', 'center', 'end'] as const
const SLANTS = [0, 1, 2] as const
const MERGES = ['none', 'side', 'near'] as const
const MERGE_GAPS = ['gap', 4] as const

const corners = ref(true)
const gap = ref<number>(8)
const clearance = ref<number>(16)
const bendCost = ref<(typeof BEND_COSTS)[number]>('auto')
const justify = ref<(typeof JUSTIFY)[number]>('center')
const jogAt = ref<(typeof JOGS)[number]>('center')
const slant = ref<number>(2)
const merge = ref<(typeof MERGES)[number]>('side')
const mergeGap = ref<(typeof MERGE_GAPS)[number]>(4)

const CLIENT = 'color(display-p3 0.14 0.34 0.26)'
const SERVICE = 'color(display-p3 0.16 0.22 0.4)'
const STORE = 'color(display-p3 0.36 0.24 0.12)'
const WORKER = 'color(display-p3 0.3 0.18 0.36)'

interface Node {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fill: string
}

const initial: ReadonlyArray<Node> = [
  { id: 'web', text: 'web app', x: 48, y: 96, width: 120, height: 40, fill: CLIENT },
  { id: 'mobile', text: 'mobile', x: 48, y: 268, width: 120, height: 40, fill: CLIENT },
  { id: 'gateway', text: 'gateway', x: 264, y: 176, width: 124, height: 48, fill: SERVICE },
  { id: 'auth', text: 'auth', x: 264, y: 392, width: 112, height: 40, fill: SERVICE },
  { id: 'orders', text: 'orders', x: 512, y: 96, width: 120, height: 40, fill: SERVICE },
  { id: 'billing', text: 'billing', x: 512, y: 288, width: 120, height: 40, fill: SERVICE },
  { id: 'events', text: 'event bus', x: 784, y: 176, width: 136, height: 40, fill: STORE },
  { id: 'db', text: 'postgres', x: 784, y: 360, width: 120, height: 40, fill: STORE },
]

const nodes = ref<Array<Node>>(initial.map((node) => ({ ...node })))

const WORKERS = ['mailer', 'indexer', 'exporter'] as const

const EDGES: ReadonlyArray<{ from: string; to: string; label?: string }> = [
  { from: 'web', to: 'gateway' },
  { from: 'mobile', to: 'gateway' },
  { from: 'gateway', to: 'auth', label: 'jwt' },
  { from: 'gateway', to: 'orders' },
  { from: 'gateway', to: 'billing' },
  { from: 'auth', to: 'db', label: 'sql' },
  { from: 'orders', to: 'events' },
  { from: 'billing', to: 'events' },
  { from: 'orders', to: 'db' },
  { from: 'billing', to: 'db' },
  ...WORKERS.map((worker) => ({ from: 'events', to: worker })),
]

// The node under the pointer, or being dragged, lights its edges.
const hovered = ref<string>()
const dragging = ref<{ id: string; dx: number; dy: number }>()
const active = computed(() => dragging.value?.id ?? hovered.value)

const lit = (edge: { from: string; to: string }) =>
  edge.from === active.value || edge.to === active.value

const stroke = (id: string) =>
  id === active.value
    ? 'color(display-p3 0.55 0.75 1 / 0.9) 1.5px'
    : 'color(srgb 1 1 1 / 0.25) 1px'

// The pointer in the drawing's coordinates.
function pointer(event: PointerEvent) {
  const svg = (event.currentTarget as SVGGraphicsElement).ownerSVGElement
  const matrix = svg?.getScreenCTM()
  if (matrix == null) {
    return undefined
  }
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
}

function grab(event: PointerEvent, node: Node) {
  const at = pointer(event)
  if (at === undefined) {
    return
  }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  dragging.value = { id: node.id, dx: at.x - node.x, dy: at.y - node.y }
}

function drag(event: PointerEvent, node: Node) {
  const held = dragging.value
  const at = pointer(event)
  if (held?.id !== node.id || at === undefined) {
    return
  }
  node.x = Math.min(Math.max(at.x - held.dx, 8), 1000 - node.width - 8)
  node.y = Math.min(Math.max(at.y - held.dy, 48), 640 - node.height - 8)
}

function drop() {
  dragging.value = undefined
}

function reset() {
  nodes.value = initial.map((node) => ({ ...node }))
}

// The settings and where each box sits, as JSON, to share a layout.
const copied = ref(false)
let unmark: ReturnType<typeof setTimeout> | undefined

async function copy() {
  const state = {
    corners: corners.value,
    gap: gap.value,
    clearance: clearance.value,
    bendCost: bendCost.value,
    justify: justify.value,
    jogAt: jogAt.value,
    slant: slant.value,
    merge: merge.value,
    mergeGap: mergeGap.value,
    nodes: nodes.value.map(({ id, x, y }) => ({ id, x, y })),
  }
  await navigator.clipboard.writeText(JSON.stringify(state))
  copied.value = true
  clearTimeout(unmark)
  unmark = setTimeout(() => (copied.value = false), 1200)
}
</script>

<style>
svg text.node {
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}
svg text.edge-label {
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.75;
}
svg g.drag {
  cursor: grab;
  touch-action: none;
}
svg g.drag:active {
  cursor: grabbing;
}
</style>
