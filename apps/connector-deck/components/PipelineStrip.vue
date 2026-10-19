<script setup lang="ts">
// The phases of `solve` in `internal/connector/pipeline.ts`, as a strip
// with the current one lit. `at` is the 1-based phase, or 0 for none.

withDefaults(defineProps<{ at?: number; vertical?: boolean }>(), { at: 0, vertical: false })

const PHASES = [
  { name: 'sides', file: 'sides.ts', kind: 'search' },
  { name: 'ports', file: 'spread.ts', kind: 'plan' },
  { name: 'merges', file: 'merge.ts', kind: 'plan' },
  { name: 'search', file: 'routing.ts', kind: 'search' },
  { name: 'nudge', file: 'nudge.ts', kind: 'geometry' },
  { name: 'straighten', file: 'ports.ts', kind: 'geometry' },
  { name: 'whisks', file: 'merge.ts', kind: 'geometry' },
  { name: 'flow', file: 'adornments.ts', kind: 'dress' },
  { name: 'corners + slants', file: 'corners.ts slants.ts', kind: 'dress' },
  { name: 'land + notes', file: 'adornments.ts', kind: 'dress' },
]
</script>

<template>
  <div class="strip" :class="{ vertical }">
    <div
      v-for="(phase, k) in PHASES"
      :key="phase.name"
      class="phase"
      :class="[phase.kind, { on: at === k + 1, past: at > k + 1 }]"
    >
      <span class="n">{{ k + 1 }}</span>
      <span class="name">{{ phase.name }}</span>
      <span v-if="vertical" class="file">{{ phase.file }}</span>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  gap: 4px;
  font-size: 0.62rem;
}
.strip.vertical {
  flex-direction: column;
  font-size: 0.8rem;
  gap: 6px;
}
.phase {
  flex: 1;
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
  padding: 0.25rem 0.45rem;
  border-radius: 6px;
  border: 1px solid #ffffff20;
  opacity: 0.45;
  white-space: nowrap;
}
.vertical .phase {
  opacity: 0.9;
}
.phase.on {
  opacity: 1;
  border-color: #fff28f;
  box-shadow: 0 0 0 1px #fff28f;
}
.phase.past {
  opacity: 0.7;
}
.n {
  font-weight: 700;
  opacity: 0.7;
}
.name {
  font-weight: 600;
}
.file {
  margin-left: auto;
  font-family: var(--slidev-code-font-family, monospace);
  opacity: 0.6;
  font-size: 0.7rem;
}
.search {
  background: #24325880;
}
.plan {
  background: #43274f80;
}
.geometry {
  background: #1f4a3a80;
}
.dress {
  background: #4f351980;
}
</style>
