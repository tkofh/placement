import {
  type ExtractPropTypes,
  type MaybeRefOrGetter,
  customRef,
  toValue,
  watch,
} from 'vue'
import { type svgPaintPropDefs, svgPaintPropKeys } from '../internal/props'

export type SVGProps = ExtractPropTypes<typeof svgPaintPropDefs>

export function svgPresentationAttributes(props: MaybeRefOrGetter<SVGProps>) {
  const attrs: Record<string, string> = {}
  return customRef<Readonly<Record<string, string>>>((track, trigger) => {
    for (const key of svgPaintPropKeys) {
      const source = () => toValue(props)[key]

      const value = source()
      if (value as boolean) {
        attrs[key] = value === true ? '' : String(value)
      }

      watch(source, (value) => {
        if (value as boolean) {
          attrs[key] = value === true ? '' : String(value)
        }
        trigger()
      })
    }

    return {
      get() {
        track()
        return attrs
      },
      set() {
        throw new Error('Readonly')
      },
    }
  })
}
