import { createInstance } from 'i18next'
import { buildInitialStoreScript, DEFAULT_GLOBAL_KEY, readInitialStore } from './initial-store'
import { usedKeysCollector, withUsedKeysCollector } from './used-keys-collector'

const resources = {
  en: { translation: { hello: 'Hello', bye: 'Bye', modal: 'Modal' } },
}

describe('initial store', () => {
  it('inlines only the keys the instance used plus extraKeys', async () => {
    const i18n = createInstance().use(usedKeysCollector)
    await i18n.init(withUsedKeysCollector({ lng: 'en', resources }))
    i18n.t('hello')

    const script = buildInitialStoreScript({ i18n, extraKeys: ['modal'] })
    expect(script).toBe(
      'window["__I18N_LAZY_KEYS_STORE__"]={"en":{"translation":{"hello":"Hello","modal":"Modal"}}};',
    )
  })

  it('readInitialStore() reads what the script assigned', () => {
    const store = { en: { translation: { hello: 'Hello' } } }
    ;(window as unknown as Record<string, unknown>)[DEFAULT_GLOBAL_KEY] = store
    expect(readInitialStore()).toBe(store)
    expect(readInitialStore('nope')).toBeUndefined()
  })
})
