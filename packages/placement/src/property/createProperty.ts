import { Property } from './Property'
import type { PropConfig } from './types'

export function createProperty<
  const Config extends Partial<PropConfig<string>>,
>(config: Config, initial: string | number) {
  return new Property(config, initial)
}
