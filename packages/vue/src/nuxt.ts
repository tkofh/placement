import {
  addComponent,
  addImports,
  addPluginTemplate,
  defineNuxtModule,
} from '@nuxt/kit'
import type {} from '@nuxt/schema'

const components = [
  'AbsoluteFrame',
  'BasicFrame',
  'FlexFrame',
  'RootFrame',
  'GraphicText',
]
const composables = ['useFrame', 'useRootRect']

const pluginTemplate = `export default definePayloadPlugin(() => {
  definePayloadReducer('Frame', (value) => {
    return value.toString() === '[object Frame]' && value.serialize()
  })
  definePayloadReviver('Frame', (value) => {
    return value
  })
})`

// biome-ignore lint/style/noDefaultExport: nuxt requires a default export
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

    for (const composable of composables) {
      addImports({
        from: `@placement/vue/${composable}`,
        name: composable,
      })
    }

    addPluginTemplate({
      name: '@placement/vue',
      filename: 'placement.js',
      mode: 'all',
      getContents: () => pluginTemplate,
    })
  },
})
