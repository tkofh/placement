import {
  AbsoluteLayoutDefinition,
  type AbsoluteLayoutOptions,
} from './AbsoluteLayoutDefinition'

export function createAbsoluteLayout(options: AbsoluteLayoutOptions) {
  return new AbsoluteLayoutDefinition(options)
}
