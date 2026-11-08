import type { i18n } from 'i18next'
import { pickResources } from './pick-resources'
import { serializeForScript } from './serialize'
import {
  firstNamespace,
  getStore,
  type ResourceStore,
  toUsedKey,
  type UsedKey,
  usedKeyId,
} from './types'
import { getUsedKeys } from './used-keys-collector'

export const DEFAULT_GLOBAL_KEY = '__I18N_LAZY_KEYS_STORE__'

export interface InitialStoreOptions {
  /** The per-request instance that rendered the page (see `createRequestInstance`). */
  i18n: i18n
  /** Keys the server render could not see (client-only UI). Plain strings use the default namespace. */
  extraKeys?: Iterable<UsedKey | string>
  /** Languages to include. Default: `i18n.languages` (current + fallbacks). */
  languages?: readonly string[]
  /** `window[globalKey]` receives the store. Default `__I18N_LAZY_KEYS_STORE__`. */
  globalKey?: string
}

/** The keys this instance used (+ `extraKeys`), shaped for i18next's `resources` option. Runs on: server render. */
export const buildInitialStore = ({
  i18n,
  extraKeys = [],
  languages,
}: Omit<InitialStoreOptions, 'globalKey'>): ResourceStore =>
  pickResources(i18n, { keys: [...getUsedKeys(i18n), ...extraKeys], languages })

/**
 * `window[globalKey]` is a queue of store chunks: every inline script pushes one. A streamed page
 * sends one chunk per flush, so chunks can arrive before or after the client instance exists —
 * `readInitialStore()` merges what is there, `followInitialStore()` applies what comes later.
 */
const pushChunkScript = (globalKey: string, chunk: ResourceStore): string => {
  const target = `window[${serializeForScript(globalKey)}]`
  return `(${target}=${target}||[]).push(${serializeForScript(chunk)});`
}

/** JavaScript that pushes the store onto `window[globalKey]` — inline it in a `<script>`. Runs on: server render. */
export const buildInitialStoreScript = (options: InitialStoreOptions): string =>
  pushChunkScript(options.globalKey ?? DEFAULT_GLOBAL_KEY, buildInitialStore(options))

/**
 * For streamed HTML: returns a function that, each time it is called, gives the script for the
 * keys used since the last call — `null` when there is nothing new. Call it on every flush
 * (Next.js: `useServerInsertedHTML`), so keys used in late `<Suspense>` boundaries still reach
 * the browser before React hydrates them. `extraKeys` go out with the first call.
 * Create one per request. Runs on: server render.
 */
export const createInitialStoreFlusher = (options: InitialStoreOptions): (() => string | null) => {
  const { i18n, languages, globalKey = DEFAULT_GLOBAL_KEY } = options
  let extraKeys: Iterable<UsedKey | string> = options.extraKeys ?? []
  const sent = new Set<string>()
  return () => {
    const defaultNS = firstNamespace(i18n.options.defaultNS)
    const fresh: UsedKey[] = []
    for (const k of [...getUsedKeys(i18n), ...extraKeys]) {
      const entry = toUsedKey(k, defaultNS)
      const id = usedKeyId(entry)
      if (sent.has(id)) continue
      // Counted as sent even if the store has no value: the lazy loader fetches those.
      sent.add(id)
      fresh.push(entry)
    }
    extraKeys = []
    if (!fresh.length) return null
    const chunk = pickResources(i18n, { keys: fresh, languages })
    return Object.keys(chunk).length ? pushChunkScript(globalKey, chunk) : null
  }
}

/** `window`, typed as the holder of chunk queues. Call only where `window` exists. */
const chunkQueues = () => window as unknown as Record<string, ResourceStore[] | undefined>

/**
 * Adds every chunk already pushed to `i18n`, then every chunk pushed later (streamed HTML keeps
 * sending them after hydration starts). Call it after `init()`. Returns a function that stops
 * following. `createLazyLoader()` calls this for you unless `followInitialStore: false`.
 * Runs on: browser.
 */
export const followInitialStore = (i18n: i18n, globalKey = DEFAULT_GLOBAL_KEY): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  const queue = (chunkQueues()[globalKey] ??= [])
  // The store, not i18n.addResourceBundle: createLazyLoader() calls this from its init(), before
  // i18next binds the store methods onto the instance (see getStore). The store also emits the
  // `added` event react-i18next listens to.
  const store = getStore(i18n)
  const apply = (chunk: ResourceStore) => {
    for (const [lng, byNs] of Object.entries(chunk))
      for (const [ns, bundle] of Object.entries(byNs))
        store.addResourceBundle(lng, ns, bundle, true, true)
  }
  for (const chunk of queue) apply(chunk)
  // Later inline scripts call queue.push(): route those chunks to i18n as well. Chain to the
  // previous push so several followers (or instances) can listen to one queue. Stopping only
  // clears a flag — restoring `previous` would break when followers stop out of order.
  let active = true
  const previous = queue.push
  queue.push = (...chunks: ResourceStore[]): number => {
    const length = previous.apply(queue, chunks)
    if (active) for (const chunk of chunks) apply(chunk)
    return length
  }
  return () => {
    active = false
  }
}

/**
 * Every chunk the server inlined so far, merged. Pass it as `resources` (with
 * `partialBundledLanguages: true`). Runs on: browser.
 */
export const readInitialStore = (globalKey = DEFAULT_GLOBAL_KEY): ResourceStore | undefined => {
  if (typeof window === 'undefined') return undefined
  const queue = chunkQueues()[globalKey]
  if (!queue) return undefined
  const out: ResourceStore = {}
  for (const chunk of queue)
    for (const [lng, byNs] of Object.entries(chunk))
      for (const [ns, bundle] of Object.entries(byNs))
        Object.assign(((out[lng] ??= {})[ns] ??= {}), bundle)
  return out
}
