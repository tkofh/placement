# @placement/vue

Vue 3 components and composables that render
[placement](https://www.npmjs.com/package/placement) layouts as SVG.
String props use CSS-flavored grammars parsed by
[valued](https://www.npmjs.com/package/valued), so `width="50%"`,
`gap="10px"`, and `align-items="center"` mean what you expect — with numbers
and placement value objects accepted wherever strings are.

```sh
pnpm add @placement/vue placement vue
```

```vue
<template>
  <GraphicRoot width="100%" height="100%" fit="contain">
    <FlexLayout flow="row" gap="10px" align-items="center">
      <FlexItem width="25%" height="80px" grow="1">
        <GraphicRect fill="cornflowerblue" r="10px" />
      </FlexItem>
      <FlexItem width="100px" height="auto">
        <GraphicRect fill="tomato" />
      </FlexItem>
    </FlexLayout>
  </GraphicRoot>
</template>
```

## Components

- `GraphicRoot` — the `<svg>` element. Measures itself with a
  ResizeObserver and maps its layout space onto the viewBox via a `fit`
  prop (`'contain' | 'cover' | 'crop'`).
- `FlexLayout` / `FlexItem` — flexbox containers and items over the core's
  `Flexbox.apply`; items receive their solved `Rect` and re-provide it as the
  sizing context for their children. Both are renderless unless given
  `class`/`style`/`debug`.
- `GraphicRect`, `GraphicCircle`, `GraphicLine`, `GraphicText`,
  `GraphicPoint`, `GraphicGroup` — SVG leaves and grouping, positioned with
  inset/size/origin props resolved against the parent context.

Every component is also available as its own subpath export
(`@placement/vue/FlexLayout`), and the prop-parsing composables live under
`@placement/vue/props/*` for building your own components.

## Nuxt

```ts
export default defineNuxtConfig({
  modules: ['@placement/vue/nuxt'],
})
```

The module registers all components globally. `@nuxt/kit` and
`@nuxt/schema` are optional peer dependencies — plain Vue apps don't
install them.

## License

MIT
