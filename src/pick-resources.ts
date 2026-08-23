import type { i18n } from 'i18next'
import { firstNamespace, type ResourceStore, type UsedKey } from './types'

export interface PickResourcesOptions {
  /** Keys to pick. Plain strings are looked up in `defaultNS`. */
  keys: Iterable<UsedKey | string>
  /** Languages to pick for. Default: `instance.languages` (current language + fallbacks). */
  languages?: readonly string[]
  /** Namespace for plain-string keys. Default: the instance's first `defaultNS`. */
  defaultNS?: string
}

/** Copy just `keys` out of the instance's store, shaped for i18next's `resources` option. Runs on: both. */
export const pickResources = (
  instance: i18n,
  { keys, languages, defaultNS }: PickResourcesOptions,
): ResourceStore => {
  const lngs = languages ?? instance.languages ?? []
  const ns0 = defaultNS ?? firstNamespace(instance.options.defaultNS)
  const entries = [...keys].map((k) => (typeof k === 'string' ? { ns: ns0, key: k } : k))
  const out: ResourceStore = {}
  for (const lng of lngs) {
    for (const { ns, key } of entries) {
      const value: unknown = instance.getResource(lng, ns, key)
      if (typeof value !== 'string') continue
      ;((out[lng] ??= {})[ns] ??= {})[key] = value
    }
  }
  return out
}
