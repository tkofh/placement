import { addComponent, defineNuxtModule } from '@nuxt/kit'

const components = [
  'FlexItem',
  'FlexLayout',
  'GraphicCircle',
  'GraphicCurve',
  'GraphicGroup',
  'GraphicLine',
  'GraphicPath',
  'GraphicPoint',
  'GraphicPolygon',
  'GraphicRect',
  'GraphicRoot',
  'GraphicText',
  'HierarchyAdornment',
  'HierarchyEdge',
  'HierarchyLayout',
  'HierarchyNode',
]

export default defineNuxtModule({
  meta: {
    name: '@placement/vue',
    configKey: 'placement',
  },
  async setup() {
    await Promise.all(
      components.map((component) =>
        addComponent({
          name: component,
          filePath: `@placement/vue/${component}`,
          export: component,
          chunkName: 'placement',
        }),
      ),
    )
  },
})
