# @placement/vue

Vue 3 components and composables that render
[placement](https://www.npmjs.com/package/placement) layouts as SVG.
String props use CSS-flavored grammars parsed by
[valued](https://www.npmjs.com/package/valued), so `width="50%"`,
`gap="10px"`, and `align-items="center"` mean what you expect. Wherever a prop
accepts a string, it also accepts a number or a placement value object.

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

- `GraphicRoot` is the `<svg>` element. It measures itself with a
  ResizeObserver and maps its layout space onto the viewBox through a `fit`
  prop (`'contain' | 'cover' | 'crop'`).
- `FlexLayout` and `FlexItem` are flexbox containers and items over the core's
  `Flexbox.apply`. Each item receives its solved `Rect` and provides it again
  as the sizing context for its children. Both are renderless unless they
  receive `class`, `style`, or `debug`.
- `GraphicRect`, `GraphicCircle`, `GraphicLine`, `GraphicText`,
  `GraphicPoint`, and `GraphicGroup` are the SVG leaf and group components.
  Their inset, size, and origin props resolve against the parent context.
- `GraphicCurve` and `GraphicPath` draw curves with
  [curvy](https://www.npmjs.com/package/curvy). `GraphicCurve` draws a spline
  through its `GraphicPoint` children. It uses Catmull-Rom by default, and the
  `curve` prop selects basis, cubic Bézier, or polyline. `GraphicPath` renders
  any curvy path or spline object as-is, or fits it onto the parent rect.

```vue
<GraphicCurve stroke="2px tomato" tension="0.4">
  <GraphicPoint v-for="(value, i) in data" :key="i"
    :left="`${(i / (data.length - 1)) * 100}%`" :bottom="value" />
</GraphicCurve>
```

Every component is also available as its own subpath export
(`@placement/vue/FlexLayout`). To build your own components, use the
prop-parsing composables under `@placement/vue/props/*`.

## Nuxt

```ts
export default defineNuxtConfig({
  modules: ['@placement/vue/nuxt'],
})
```

The module registers all components globally. `@nuxt/kit` and
`@nuxt/schema` are optional peer dependencies, so plain Vue apps do not
install them.

## License

MIT
