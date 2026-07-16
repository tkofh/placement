import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/dimensions.ts',
    'src/flexbox.ts',
    'src/frame.ts',
    'src/interval.ts',
    'src/offset.ts',
    'src/point.ts',
    'src/rect.ts',
    'src/track.ts',
    'src/utils.ts',
  ],
  format: 'esm',
  dts: true,
  sourcemap: true,
  target: 'es2022',
  clean: true,
  outputOptions: {
    entryFileNames: '[name].mjs',
    chunkFileNames: 'shared/[name]-[hash].mjs',
  },
  tsconfig: './tsconfig.json',
})
