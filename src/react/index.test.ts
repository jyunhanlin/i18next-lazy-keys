import { createInstance } from 'i18next'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { usedKeysCollector, withUsedKeysCollector } from '../used-keys-collector'
import { createInitialStoreScriptFlusher, InitialStoreScript } from './index'

const createI18n = async () => {
  const i18n = createInstance().use(usedKeysCollector)
  await i18n.init(
    withUsedKeysCollector({
      lng: 'en',
      resources: { en: { translation: { hello: 'Hello', bye: 'Bye' } } },
    }),
  )
  return i18n
}

describe('<InitialStoreScript>', () => {
  it('renders the store script for the keys the instance used', async () => {
    const i18n = await createI18n()
    i18n.t('hello')

    const html = renderToString(createElement(InitialStoreScript, { i18n, nonce: 'n1' }))
    expect(html).toBe(
      '<script id="i18next-lazy-keys-store" nonce="n1">(window["__I18N_LAZY_KEYS_STORE__"]=window["__I18N_LAZY_KEYS_STORE__"]||[]).push({"en":{"translation":{"hello":"Hello"}}});</script>',
    )
  })
})

describe('createInitialStoreScriptFlusher()', () => {
  it('returns a <script> with the new keys and the nonce, then null when nothing is new', async () => {
    const i18n = await createI18n()
    const flush = createInitialStoreScriptFlusher({ i18n, nonce: 'n1' })
    i18n.t('hello')

    const first = flush()
    expect(first && renderToString(first)).toBe(
      '<script nonce="n1">(window["__I18N_LAZY_KEYS_STORE__"]=window["__I18N_LAZY_KEYS_STORE__"]||[]).push({"en":{"translation":{"hello":"Hello"}}});</script>',
    )
    expect(flush()).toBeNull()
  })
})
