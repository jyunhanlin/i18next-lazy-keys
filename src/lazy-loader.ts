import type { i18n, ThirdPartyModule } from 'i18next'

export interface LoadKeysArgs {
  language: string
  namespace: string
  keys: string[]
}

export interface LazyLoaderOptions {
  /** Fetch translations for `keys`. Return `{ key: value }`; keys left out are stored as `notFound(key)`. */
  loadKeys: (args: LoadKeysArgs) => Promise<Record<string, string>>
  /** Batch window: reports within this many ms share one `loadKeys` call. Default 100. */
  throttleMs?: number
  /** Max keys per `loadKeys` call (keeps URLs short). Default 60. */
  chunkSize?: number
  /** What `t()` returns while a key is loading. Default `''` — no flash of raw keys. */
  missingValue?: (key: string) => string
  /** What is stored when `loadKeys` does not return the key. Default: the key itself. */
  notFound?: (key: string) => string
  /** Keys never to fetch. Default: react-i18next `<Trans>` children used as keys (`<0>…</0>`). */
  skipKey?: (key: string) => boolean
  /** Called when `loadKeys` rejects. The keys are released and retried on their next report. */
  onError?: (error: unknown, args: LoadKeysArgs) => void
}

const TRANS_MARKUP = /<\d+>[\s\S]*?<\/\d+>/

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const requestId = (language: string, namespace: string, key: string) =>
  `${language}|${namespace}|${key}`

/**
 * i18next 3rdParty plugin: fetch translations key by key, on first use.
 *
 * Turns on `saveMissing` and listens to i18next's `missingKey` event. Missing keys are batched
 * per language/namespace, fetched with `loadKeys`, and added with `addResourceBundle` —
 * react-i18next re-renders when `react.bindI18nStore` includes `'added'`.
 *
 * Runs on: browser (the client instance). Do not add it to the server root instance.
 *
 * TODO(languageChanged): after a language switch, keys that resolve through `fallbackLng` never
 *   report as missing, so the new language would stay on fallback text. Port the step that
 *   refetches every key already in the store for the new language.
 * TODO(loadGroups): optional "a key in namespace X is missing → fetch all of X" hook.
 */
export const createLazyLoader = (options: LazyLoaderOptions): ThirdPartyModule => {
  const {
    loadKeys,
    throttleMs = 100,
    chunkSize = 60,
    missingValue = () => '',
    notFound = (key) => key,
    skipKey = (key) => TRANS_MARKUP.test(key),
    onError,
  } = options

  let instance: i18n | undefined
  /** language -> namespace -> keys waiting for the next flush */
  const queued = new Map<string, Map<string, Set<string>>>()
  /** `${language}|${namespace}|${key}` in flight or done */
  const requested = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const fetchPart = async (language: string, namespace: string, keys: string[]) => {
    const args = { language, namespace, keys }
    for (const key of keys) requested.add(requestId(language, namespace, key))
    let loaded: Record<string, string>
    try {
      loaded = await loadKeys(args)
    } catch (error) {
      for (const key of keys) requested.delete(requestId(language, namespace, key))
      onError?.(error, args)
      return
    }
    const bundle: Record<string, string> = {}
    for (const key of keys)
      bundle[key] = typeof loaded[key] === 'string' ? loaded[key] : notFound(key)
    instance?.addResourceBundle(language, namespace, bundle)
  }

  const flush = () => {
    timer = undefined
    const batch = [...queued]
    queued.clear()
    const jobs: Promise<void>[] = []
    for (const [language, byNs] of batch)
      for (const [namespace, keys] of byNs)
        for (const part of chunk([...keys], chunkSize))
          jobs.push(fetchPart(language, namespace, part))
    return Promise.all(jobs)
  }

  const enqueue = (language: string, namespace: string, key: string) => {
    let byNs = queued.get(language)
    if (!byNs) queued.set(language, (byNs = new Map()))
    let keys = byNs.get(namespace)
    if (!keys) byNs.set(namespace, (keys = new Set()))
    keys.add(key)
    timer ??= setTimeout(() => void flush(), throttleMs)
  }

  return {
    type: '3rdParty',
    init(i18n: i18n) {
      instance = i18n
      i18n.options.saveMissing = true
      // i18next's defaults for both handlers are `false` (not undefined), so test truthiness.
      // Without a missingKeyHandler i18next falls through to backendConnector.saveMissing(), which
      // writes `key: key` into the store (and calls backend.create()) — the key would then stop
      // reporting as missing and we could never replace it.
      if (!i18n.options.missingKeyHandler) i18n.options.missingKeyHandler = () => {}
      if (!i18n.options.parseMissingKeyHandler) {
        i18n.options.parseMissingKeyHandler = (key: string) =>
          skipKey(key) ? key : missingValue(key)
      }
      i18n.on('missingKey', (_languages, namespace, key) => {
        if (!key || skipKey(key)) return
        const language = i18n.language
        if (!language || requested.has(requestId(language, namespace, key))) return
        enqueue(language, namespace, key)
      })
    },
  }
}
