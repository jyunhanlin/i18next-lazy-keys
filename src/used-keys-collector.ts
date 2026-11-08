import type { i18n, InitOptions, PostProcessorModule, TOptions } from 'i18next'
import { firstNamespace, getTranslator, type TranslatorRef, type UsedKey } from './types'

const buckets = new WeakMap<TranslatorRef, Map<string, UsedKey>>()

const entryId = ({ ns, key }: UsedKey): string => JSON.stringify([ns, key])

interface ResolvedInfo {
  /** The key as asked for: `item` for `t('item', { count: 3 })`. */
  usedKey?: string
  /** The key that is in the store: `item_other` (plural / context suffix applied). */
  exactUsedKey?: string
  usedNS?: string
}

const resolveEntries = (
  key: string | string[],
  options: TOptions,
  translator: TranslatorRef,
): UsedKey[] => {
  const resolved = (options as { i18nResolved?: ResolvedInfo }).i18nResolved
  const defaultNS = (translator as { options?: { defaultNS?: unknown } }).options?.defaultNS
  const ns = firstNamespace(options.ns ?? defaultNS)
  // With `postProcessPassResolved: true` i18next tells us which key/namespace actually resolved —
  // exact even for `t(['a', 'b'])` fallbacks and `fallbackNS`. Without it, record what was asked for.
  // Prefer `exactUsedKey`: it carries the plural/context suffix, so it names the entry the store
  // (and the browser) needs. `usedKey` is the base key, which pickResources() would not find.
  const resolvedKey = resolved?.exactUsedKey ?? resolved?.usedKey
  if (resolvedKey !== undefined) return [{ ns: resolved?.usedNS ?? ns, key: resolvedKey }]
  return (Array.isArray(key) ? key : [key]).map((k) => ({ ns, key: k }))
}

/**
 * i18next postProcessor that records every key `t()` returned, per instance.
 *
 * i18next keeps postProcessors in one global registry, so register this once at module level —
 * never per request. Per-request attribution comes from the translator argument: give each
 * request its own instance with `createRequestInstance()` and read back with `getUsedKeys()`.
 *
 * Runs on: server render (harmless but pointless in the browser).
 */
export const usedKeysCollector: PostProcessorModule = {
  type: 'postProcessor',
  name: 'usedKeysCollector',
  process(value, key, options, translator: TranslatorRef) {
    let bucket = buckets.get(translator)
    if (!bucket) {
      bucket = new Map()
      buckets.set(translator, bucket)
    }
    for (const entry of resolveEntries(key, options, translator)) bucket.set(entryId(entry), entry)
    return value
  },
}

/** Keys `t()` returned on this instance since it was created (or last cleared). Runs on: server render. */
export const getUsedKeys = (instance: i18n): UsedKey[] => {
  const translator = getTranslator(instance)
  const bucket = translator && buckets.get(translator)
  return bucket ? [...bucket.values()] : []
}

export const clearUsedKeys = (instance: i18n): void => {
  const translator = getTranslator(instance)
  if (translator) buckets.delete(translator)
}

/**
 * Adds the collector to `postProcess` and turns on `postProcessPassResolved` for exact attribution.
 * Runs on: server render (root instance init).
 */
export const withUsedKeysCollector = <T extends InitOptions>(options: T): T => {
  const current = options.postProcess
  const list =
    current === false || current === undefined
      ? []
      : typeof current === 'string'
        ? [current]
        : [...current]
  if (!list.includes(usedKeysCollector.name)) list.push(usedKeysCollector.name)
  return { ...options, postProcess: list, postProcessPassResolved: true }
}
