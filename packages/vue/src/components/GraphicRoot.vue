<template>
  <svg>
    <slot />
  </svg>
</template>

<script lang="ts" setup>
import type {
  DimensionsAspectRatioInput,
  DimensionsHeightInput,
  DimensionsWidthInput,
} from 'placement/dimensions'
import { parseDimensions } from 'placement/dimensions'
import { computed, defineProps } from 'vue'

const props = withDefaults(
  defineProps<{
    width?: DimensionsWidthInput
    height?: DimensionsHeightInput
    aspectRatio?: DimensionsAspectRatioInput
    fit?: 'contain' | 'cover' | 'stretch'
    invertY?: boolean
  }>(),
  {
    width: '100%',
    height: '100%',
    aspectRatio: '1',
    fit: 'contain',
    invertY: false,
  },
)

const _dimensions = computed(() =>
  parseDimensions(props, { width: 1600, height: 900 }),
)
</script>
