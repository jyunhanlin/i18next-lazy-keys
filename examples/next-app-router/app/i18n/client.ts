import i18next, { type i18n } from 'i18next'
import { createLazyLoader, readInitialStore } from 'i18next-lazy-keys'
import { initReactI18next } from 'react-i18next'
import { defaultNS, fallbackLng } from './options'

let instance: i18n | undefined

/**
 * The browser's single instance. Created on the first client render — that is during hydration,
 * after the inline <script> has run, so readInitialStore() already sees the server's store.
 */
export const getClientI18n = (lng: string): i18n => {
  if (instance) return instance
  instance = i18next
    .createInstance()
    .use(initReactI18next)
    .use(
      createLazyLoader({
        loadKeys: async ({ language, namespace, keys }) => {
          const url = new URL('/api/translations', location.origin)
          url.searchParams.set('lang', language)
          url.searchParams.set('ns', namespace)
          for (const key of keys) url.searchParams.append('key', key)
          const response = await fetch(url)
          if (!response.ok) throw new Error(`translations ${response.status}`)
          return response.json()
        },
      }),
    )
  // initAsync: false — init() must finish before this returns, or the first client render
  // has no translations and hydration mismatches. (i18next >= 24; 23 called it initImmediate.)
  void instance.init({
    lng,
    fallbackLng,
    defaultNS,
    resources: readInitialStore(),
    partialBundledLanguages: true,
    initAsync: false,
    react: { bindI18nStore: 'added' }, // re-render when lazy keys arrive
  })
  return instance
}
