import type { i18n } from 'i18next'
import { pickResources } from './pick-resources'
import { serializeForScript } from './serialize'
import type { ResourceStore, UsedKey } from './types'
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

/** JavaScript that assigns the store to `window[globalKey]` — inline it in a `<script>`. Runs on: server render. */
export const buildInitialStoreScript = (options: InitialStoreOptions): string => {
  const { globalKey = DEFAULT_GLOBAL_KEY } = options
  return `window[${serializeForScript(globalKey)}]=${serializeForScript(buildInitialStore(options))};`
}

/** The store the server inlined. Pass it as `resources` (with `partialBundledLanguages: true`). Runs on: browser. */
export const readInitialStore = (globalKey = DEFAULT_GLOBAL_KEY): ResourceStore | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as Record<string, ResourceStore | undefined>)[globalKey]
