import { createInstance } from 'i18next'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { usedKeysCollector, withUsedKeysCollector } from '../used-keys-collector'
import { InitialStoreScript } from './index'

describe('<InitialStoreScript>', () => {
  it('renders the store script for the keys the instance used', async () => {
    const i18n = createInstance().use(usedKeysCollector)
    await i18n.init(
      withUsedKeysCollector({
        lng: 'en',
        resources: { en: { translation: { hello: 'Hello', bye: 'Bye' } } },
      }),
    )
    i18n.t('hello')

    const html = renderToString(createElement(InitialStoreScript, { i18n, nonce: 'n1' }))
    expect(html).toBe(
      '<script id="i18next-lazy-keys-store" nonce="n1">window["__I18N_LAZY_KEYS_STORE__"]={"en":{"translation":{"hello":"Hello"}}};</script>',
    )
  })
})
