import i18next, { type i18n } from 'i18next'
import { createRequestInstance, usedKeysCollector, withUsedKeysCollector } from 'i18next-lazy-keys'
import { defaultNS, fallbackLng } from './options'
import { resources } from './resources'

// One root per server process. It holds every language; requests clone it.
// Memoized promise instead of top-level await, so importing this module has no side effect.
let root: Promise<i18n> | undefined

const getRoot = (): Promise<i18n> =>
  (root ??= (async () => {
    // usedKeysCollector goes into i18next's global postProcessor registry: register it once, here.
    const instance = i18next.createInstance().use(usedKeysCollector)
    await instance.init(withUsedKeysCollector({ fallbackLng, defaultNS, resources }))
    return instance
  })())

/** A fresh instance for one request: own language, own used-keys record. */
export const createRequestI18n = async (lng: string): Promise<i18n> =>
  createRequestInstance(await getRoot(), { lng })
