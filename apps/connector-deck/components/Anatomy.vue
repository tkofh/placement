<script setup lang="ts">
import { pathOf, type XY } from '../utils/scene'

// The parts of a route, labeled: drawn by hand to show the vocabulary, not
// routed. `show` names which callouts to draw (all by default).

const props = withDefaults(defineProps<{ show?: string }>(), {
  show: 'port leg corner jog run clearance gap arrow label pack',
})
const has = (part: string) => props.show.split(/\s+/).includes(part)

const R = 16
// Route 1: A's right side to B's left, a Z with a jog in the middle.
const route1: Array<XY> = [
  [170, 110],
  [330, 110],
  [330, 250],
  [560, 250],
]
// Route 2, alongside route 1 a gap away through the middle.
const route2: Array<XY> = [
  [170, 126],
  [314, 126],
  [314, 266],
  [560, 266],
]
</script>

<template>
  <svg viewBox="0 0 760 360" class="anatomy">
    <!-- clearance halos -->
    <g v-if="has('clearance')" fill="#ffffff06" stroke="#ffffff55" stroke-dasharray="4 3">
      <rect x="24" y="64" width="162" height="108" rx="4" />
      <rect x="544" y="214" width="162" height="98" rx="4" />
      <rect x="384" y="34" width="132" height="132" rx="4" />
    </g>
    <rect x="40" y="80" width="130" height="76" rx="10" fill="#243258" stroke="#ffffff40" />
    <text x="105" y="124" text-anchor="middle" class="node">A</text>
    <rect x="560" y="230" width="130" height="66" rx="10" fill="#4f3519" stroke="#ffffff40" />
    <text x="625" y="269" text-anchor="middle" class="node">B</text>
    <rect x="400" y="50" width="100" height="100" rx="2" fill="#30343f" stroke="#ffffff30" />
    <text x="450" y="104" text-anchor="middle" class="dim">obstacle</text>

    <path
      :d="pathOf(route2, [0, R, R, 0])"
      fill="none"
      stroke="#ffb38f"
      stroke-width="2"
      style="opacity: 0.8"
    />
    <path :d="pathOf(route1, [0, R, R, 0])" fill="none" stroke="#8fb8ff" stroke-width="2.5" />
    <path d="M560 250 L549 244 L549 256 Z" fill="#8fb8ff" />
    <path d="M560 266 L549 260 L549 272 Z" fill="#ffb38f" />
    <rect x="420" y="241" width="44" height="18" rx="4" fill="#0b0e19" stroke="#8fb8ff" />
    <text x="442" y="254" text-anchor="middle" class="tag">sql</text>

    <!-- callouts -->
    <g class="callout">
      <g v-if="has('port')">
        <circle cx="170" cy="110" r="5" fill="#fff28f" />
        <text x="178" y="92">port</text>
      </g>
      <g v-if="has('leg')">
        <line
          x1="176"
          y1="102"
          x2="312"
          y2="102"
          stroke="#fff28f"
          stroke-width="1"
          marker-end="url(#tick)"
        />
        <text x="214" y="84">port leg</text>
      </g>
      <g v-if="has('corner')">
        <circle cx="314" cy="126" r="16" fill="none" stroke="#a8ff8f" stroke-dasharray="2 2" />
        <text x="252" y="60" fill="#a8ff8f">corner · radius R</text>
        <line x1="300" y1="66" x2="322" y2="104" stroke="#a8ff8f" />
      </g>
      <g v-if="has('jog')">
        <line x1="346" y1="128" x2="346" y2="232" stroke="#ff8fd6" stroke-width="1" />
        <text x="352" y="186" fill="#ff8fd6">jog</text>
        <text x="352" y="202" fill="#ff8fd6" class="small">(the rise of a Z)</text>
      </g>
      <g v-if="has('run')">
        <text x="240" y="300" fill="#8ffff2">run / segment</text>
        <line x1="300" y1="290" x2="380" y2="272" stroke="#8ffff2" />
      </g>
      <g v-if="has('gap')">
        <line x1="520" y1="250" x2="520" y2="266" stroke="#fff" stroke-width="1" />
        <text x="470" y="294" fill="#fff" class="small">gap</text>
        <line x1="492" y1="288" x2="518" y2="262" stroke="#fff" stroke-width="0.7" />
      </g>
      <g v-if="has('clearance')">
        <text x="24" y="190" class="small" fill="#ffffffa0">clearance</text>
      </g>
      <g v-if="has('arrow')">
        <text x="560" y="214" fill="#8fb8ff" class="small">arrowhead (flow adornment at 1)</text>
      </g>
      <g v-if="has('label')">
        <text x="398" y="234" fill="#8fb8ff" class="small">label (flow, between)</text>
      </g>
      <g v-if="has('pack')">
        <line x1="545" y1="282" x2="560" y2="282" stroke="#d68fff" stroke-width="2" />
        <text x="500" y="330" fill="#d68fff" class="small">
          pack: room the end's adornments take
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.anatomy {
  width: 100%;
  height: 100%;
}
.node {
  font-size: 18px;
  font-weight: 700;
  fill: #fff;
}
.dim {
  font-size: 12px;
  fill: #ffffff80;
}
.tag {
  font-size: 11px;
  fill: #8fb8ff;
  letter-spacing: 0.06em;
}
.callout text {
  font-size: 15px;
  fill: #fff28f;
  font-weight: 600;
}
.callout text.small {
  font-size: 12px;
  font-weight: 500;
}
</style>
