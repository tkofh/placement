<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { FILLS, OUTWARD, type XY, boundsOf, colorOf, pathOf, sceneOf } from '../utils/scene'

// One routed scene from `data/`, drawn in layers. `layers` names what to
// draw, any of: clearance zones graph nodes pins candidates ports rects
// routes adornments points jogs. `phase` picks which routes: `final` (as
// returned, corners rounded), `trial` (side selection's), or a traced
// phase (`search`, `nudge`, `ports`, `whisks`, `slants`). `ghost` draws a
// second phase faintly under the first.

const props = withDefaults(
  defineProps<{
    scene: string
    layers?: string
    phase?: string
    ghost?: string
    only?: Array<number>
    highlight?: Array<number>
    view?: Array<number>
    path?: Array<number>
    stroke?: number
  }>(),
  { layers: 'rects routes adornments', phase: 'final', stroke: 1.75 },
)

const data = computed(() => sceneOf(props.scene))
const has = (layer: string) => props.layers.split(/\s+/).includes(layer)
const box = computed(() => {
  if (props.view !== undefined && props.view.length === 4) {
    const [x, y, width, height] = props.view as [number, number, number, number]
    return { x, y, width, height }
  }
  return boundsOf(data.value)
})
const viewBox = computed(
  () => `${box.value.x} ${box.value.y} ${box.value.width} ${box.value.height}`,
)
// One screen pixel in the drawing's units, so strokes and dots keep their
// size on screen whatever the view and the panel.
const el = ref<SVGSVGElement>()
const size = ref({ width: 0, height: 0 })
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (el.value) size.value = { width: el.value.clientWidth, height: el.value.clientHeight }
  })
  if (el.value) observer.observe(el.value)
})
onBeforeUnmount(() => observer?.disconnect())
const unit = computed(() => {
  const { width, height } = size.value
  if (!(width > 0 && height > 0)) return box.value.width / 800
  return 1 / Math.min(width / box.value.width, height / box.value.height)
})
// Node labels read at about 10px, as far as their rects hold them.
const fontOf = (r: { height: number }) => Math.min(r.height * 0.34, 11 * unit.value)

const shown = (i: number) => props.only === undefined || props.only.includes(i)
const dim = (i: number) => props.highlight !== undefined && !props.highlight.includes(i)

interface Drawn {
  i: number
  d: string
  points: Array<XY>
}

function routesOf(phase: string): Array<Drawn> {
  const scene = data.value
  const list: Array<Drawn> = []
  for (const i of scene.links.keys()) {
    if (!shown(i)) continue
    if (phase === 'final') {
      const route = scene.routes[i]
      if (route) list.push({ i, d: pathOf(route.points, route.radii), points: route.points })
    } else {
      const points = phase === 'trial' ? scene.trial[i] : scene.phases[phase]?.[i]
      if (points) list.push({ i, d: pathOf(points), points })
    }
  }
  return list
}

const routes = computed(() => routesOf(props.phase))
const ghosts = computed(() => (props.ghost === undefined ? [] : routesOf(props.ghost)))

// Segments shorter than two corner radii, between two corners.
const jogs = computed(() => {
  const r = data.value.settings.radius
  const marks: Array<{ i: number; a: XY; b: XY }> = []
  for (const { i, points } of routes.value) {
    for (let k = 1; k + 2 < points.length; k++) {
      const a = points[k] as XY
      const b = points[k + 1] as XY
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (length > 0.01 && length < 2 * r) marks.push({ i, a, b })
    }
  }
  return marks
})

const arrows = computed(() => {
  if (props.phase !== 'final') return []
  const scene = data.value
  return scene.routes.flatMap((route, i) => {
    if (!route || !shown(i)) return []
    return route.adornments.map((a, k) => ({
      i,
      k,
      ...a,
      label: k === 1 ? scene.links[i]?.label : null,
    }))
  })
})

const portMark = (x: number, y: number, side: number, size: number) => {
  const [ox, oy] = OUTWARD[side] as XY
  const [px, py] = [-oy, ox]
  return `M${x + px * size} ${y + py * size} L${x + ox * size * 1.6} ${y + oy * size * 1.6} L${x - px * size} ${y - py * size} Z`
}

const pathNodes = computed(() => {
  if (!props.path) return ''
  const nodes = data.value.graph.nodes
  return props.path
    .map((n, k) => `${k === 0 ? 'M' : 'L'}${(nodes[n] as XY)[0]} ${(nodes[n] as XY)[1]}`)
    .join(' ')
})
</script>

<template>
  <svg ref="el" :viewBox="viewBox" class="scene" xmlns="http://www.w3.org/2000/svg">
    <g v-if="has('clearance')">
      <rect
        v-for="(o, k) in data.obstacles"
        :key="`o${k}`"
        :x="o.x"
        :y="o.y"
        :width="o.width"
        :height="o.height"
        fill="#ffffff08"
        stroke="#ffffff50"
        :stroke-width="unit"
        :stroke-dasharray="`${4 * unit} ${3 * unit}`"
      />
    </g>
    <g v-if="has('zones')">
      <rect
        v-for="(o, k) in data.zones"
        :key="`z${k}`"
        :x="o.x"
        :y="o.y"
        :width="o.width"
        :height="o.height"
        fill="#ff8fd620"
        stroke="#ff8fd6a0"
        :stroke-width="unit"
      />
    </g>
    <g v-if="has('graph')" stroke="#6f8cff" :stroke-width="0.8 * unit" style="opacity: 0.45">
      <line
        v-for="([a, b], k) in data.graph.edges"
        :key="`e${k}`"
        :x1="data.graph.nodes[a]![0]"
        :y1="data.graph.nodes[a]![1]"
        :x2="data.graph.nodes[b]![0]"
        :y2="data.graph.nodes[b]![1]"
      />
    </g>
    <g v-if="has('nodes')" fill="#9fb3ff">
      <circle
        v-for="([x, y], k) in data.graph.nodes"
        :key="`n${k}`"
        :cx="x"
        :cy="y"
        :r="1.8 * unit"
      />
    </g>
    <g v-if="has('rects')">
      <g v-for="r in data.rects" :key="r.id">
        <rect
          :x="r.x"
          :y="r.y"
          :width="r.width"
          :height="r.height"
          :rx="r.kind === 'wall' ? 2 : 10"
          :fill="FILLS[r.kind] ?? FILLS.node"
          stroke="#ffffff40"
          :stroke-width="unit"
        />
        <text
          v-if="r.label"
          :x="r.x + r.width / 2"
          :y="r.y + r.height / 2 + fontOf(r) * 0.36"
          :font-size="fontOf(r)"
          text-anchor="middle"
          class="label"
        >
          {{ r.label }}
        </text>
      </g>
    </g>
    <g v-if="has('candidates')">
      <path
        v-for="(c, k) in data.candidates"
        :key="`c${k}`"
        :d="portMark(c.x, c.y, c.side, 4 * unit)"
        fill="#fff28f"
        style="opacity: 0.8"
      />
    </g>
    <path
      v-if="pathNodes"
      :d="pathNodes"
      fill="none"
      stroke="#fff28f"
      :stroke-width="3 * unit"
      stroke-linejoin="round"
    />
    <g v-for="r in ghosts" :key="`g${r.i}`">
      <path
        :d="r.d"
        fill="none"
        :stroke="colorOf(r.i)"
        :stroke-width="stroke * unit"
        :stroke-dasharray="`${3 * unit} ${3 * unit}`"
        style="opacity: 0.35"
      />
    </g>
    <g v-if="has('routes')">
      <path
        v-for="r in routes"
        :key="`r${r.i}`"
        :d="r.d"
        fill="none"
        :stroke="colorOf(r.i)"
        :stroke-width="stroke * unit * (dim(r.i) ? 0.8 : 1)"
        stroke-linejoin="round"
        :style="{ opacity: dim(r.i) ? 0.18 : 0.95 }"
      />
    </g>
    <g v-if="has('points')">
      <template v-for="r in routes" :key="`p${r.i}`">
        <circle
          v-for="([x, y], k) in r.points"
          :key="k"
          :cx="x"
          :cy="y"
          :r="2.2 * unit"
          :fill="colorOf(r.i)"
          :style="{ opacity: dim(r.i) ? 0.15 : 0.9 }"
        />
      </template>
    </g>
    <g v-if="has('jogs')">
      <line
        v-for="(j, k) in jogs"
        :key="`j${k}`"
        :x1="j.a[0]"
        :y1="j.a[1]"
        :x2="j.b[0]"
        :y2="j.b[1]"
        stroke="#ff5f6d"
        :stroke-width="5 * unit"
        stroke-linecap="round"
        style="opacity: 0.8"
      />
    </g>
    <g v-if="has('adornments')">
      <g
        v-for="a in arrows"
        :key="`a${a.i}-${a.k}`"
        :transform="`rotate(${a.angle} ${a.x + a.width / 2} ${a.y + a.height / 2})`"
        :style="{ opacity: dim(a.i) ? 0.18 : 1 }"
      >
        <path
          v-if="a.k === 0"
          :d="`M${a.x} ${a.y} L${a.x + a.width} ${a.y + a.height / 2} L${a.x} ${a.y + a.height} Z`"
          :fill="colorOf(a.i)"
        />
        <template v-else>
          <rect
            :x="a.x"
            :y="a.y"
            :width="a.width"
            :height="a.height"
            rx="3"
            fill="#0b0e19"
            :stroke="colorOf(a.i)"
            :stroke-width="0.8 * unit"
          />
          <text
            :x="a.x + a.width / 2"
            :y="a.y + a.height / 2 + 3.5"
            text-anchor="middle"
            class="edge-label"
            :fill="colorOf(a.i)"
          >
            {{ a.label }}
          </text>
        </template>
      </g>
    </g>
    <g v-if="has('ports')">
      <template v-for="(pair, i) in data.ports" :key="`pt${i}`">
        <circle
          v-for="(p, end) in pair"
          v-show="shown(i)"
          :key="end"
          :cx="p.x"
          :cy="p.y"
          :r="4 * unit"
          :fill="colorOf(i)"
          stroke="#0b0e19"
          :stroke-width="unit"
        />
      </template>
    </g>
    <g v-if="has('pins')" fill="#fff28f">
      <circle
        v-for="n in data.graph.pins"
        :key="`pin${n}`"
        :cx="data.graph.nodes[n]![0]"
        :cy="data.graph.nodes[n]![1]"
        :r="3.2 * unit"
      />
    </g>
    <slot :unit="unit" />
  </svg>
</template>

<style scoped>
.scene {
  width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}
.label {
  font-weight: 600;
  fill: #fff;
  font-family: Inter, Helvetica, Arial, sans-serif;
}
.edge-label {
  font-size: 9px;
  letter-spacing: 0.06em;
  font-family: Inter, Helvetica, Arial, sans-serif;
}
</style>
