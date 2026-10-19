<script setup lang="ts">
// Why the search's state is the half-edge a path arrived along, not the
// node: the same node reached heading right or heading down costs the same
// to reach, but not the same to leave right. `step` reveals the parts.

withDefaults(defineProps<{ step?: number }>(), { step: 3 })
</script>

<template>
  <svg viewBox="0 0 640 320" class="states">
    <defs>
      <marker
        id="ts-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M0 0 L10 5 L0 10 Z" fill="context-stroke" />
      </marker>
    </defs>
    <!-- grid -->
    <g stroke="#6f8cff" stroke-width="1" style="opacity: 0.4">
      <line x1="60" y1="160" x2="580" y2="160" />
      <line x1="320" y1="20" x2="320" y2="300" />
    </g>
    <circle cx="320" cy="160" r="9" fill="#9fb3ff" />
    <text x="336" y="186" class="t">n</text>

    <!-- arriving heading right -->
    <g v-if="step >= 1">
      <line
        x1="80"
        y1="160"
        x2="306"
        y2="160"
        stroke="#8fb8ff"
        stroke-width="4"
        marker-end="url(#ts-arrow)"
      />
      <text x="90" y="146" class="t" fill="#8fb8ff">state (n, →)</text>
    </g>
    <!-- arriving heading down -->
    <g v-if="step >= 2">
      <line
        x1="320"
        y1="30"
        x2="320"
        y2="146"
        stroke="#ffb38f"
        stroke-width="4"
        marker-end="url(#ts-arrow)"
      />
      <text x="332" y="50" class="t" fill="#ffb38f">state (n, ↓)</text>
    </g>
    <!-- leaving right -->
    <g v-if="step >= 3">
      <line
        x1="334"
        y1="160"
        x2="560"
        y2="160"
        stroke="#a8ff8f"
        stroke-width="4"
        marker-end="url(#ts-arrow)"
        stroke-dasharray="8 5"
      />
      <text x="420" y="146" class="t" fill="#a8ff8f">leave →</text>
      <text x="90" y="230" class="s" fill="#8fb8ff">from (n, →): + length</text>
      <text x="90" y="256" class="s" fill="#ffb38f">from (n, ↓): + length + bendCost</text>
      <text x="90" y="292" class="s" fill="#ffffffa0">
        so one node is up to four search states (one per heading)
      </text>
    </g>
  </svg>
</template>

<style scoped>
.states {
  width: 100%;
  height: 100%;
}
.t {
  font-size: 17px;
  font-weight: 700;
  fill: #fff;
}
.s {
  font-size: 16px;
  font-family: var(--slidev-code-font-family, monospace);
}
</style>
