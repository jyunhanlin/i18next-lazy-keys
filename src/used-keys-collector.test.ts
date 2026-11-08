import { createInstance } from 'i18next'
import {
  clearUsedKeys,
  getUsedKeys,
  usedKeysCollector,
  withUsedKeysCollector,
} from './used-keys-collector'

const resources = {
  en: {
    translation: {
      hello: 'Hello',
      bye: 'Bye',
      item_one: '{{count}} item',
      item_other: '{{count}} items',
    },
    seo: { title: 'Title' },
  },
  ja: { translation: { hello: 'こんにちは' } },
}

const createRoot = async () => {
  const instance = createInstance().use(usedKeysCollector)
  await instance.init(withUsedKeysCollector({ lng: 'en', fallbackLng: 'en', resources }))
  return instance
}

describe('usedKeysCollector', () => {
  it('records keys t() returned, with the namespace they resolved in', async () => {
    const i18n = await createRoot()
    i18n.t('hello')
    i18n.t('title', { ns: 'seo' })
    i18n.t('hello') // duplicates collapse
    expect(getUsedKeys(i18n)).toEqual([
      { ns: 'translation', key: 'hello' },
      { ns: 'seo', key: 'title' },
    ])
  })

  it('records the key that actually resolved for fallback key lists', async () => {
    const i18n = await createRoot()
    i18n.t(['missing', 'bye'])
    expect(getUsedKeys(i18n)).toEqual([{ ns: 'translation', key: 'bye' }])
  })

  it('records the plural-suffixed key that resolved for t(key, { count })', async () => {
    const i18n = await createRoot()
    i18n.t('item', { count: 3 })
    i18n.t('item', { count: 1 })
    expect(getUsedKeys(i18n)).toEqual([
      { ns: 'translation', key: 'item_other' },
      { ns: 'translation', key: 'item_one' },
    ])
  })

  it('keeps clones apart (one request, one instance)', async () => {
    const root = await createRoot()
    const a = root.cloneInstance({ lng: 'en' })
    const b = root.cloneInstance({ lng: 'ja' })
    a.t('hello')
    b.t('hello')
    a.t('bye')
    expect(getUsedKeys(a).map((e) => e.key)).toEqual(['hello', 'bye'])
    expect(getUsedKeys(b).map((e) => e.key)).toEqual(['hello'])
    expect(getUsedKeys(root)).toEqual([])
  })

  it('clearUsedKeys() resets one instance', async () => {
    const i18n = await createRoot()
    i18n.t('hello')
    clearUsedKeys(i18n)
    expect(getUsedKeys(i18n)).toEqual([])
  })

  it('withUsedKeysCollector() appends to an existing postProcess list', () => {
    expect(withUsedKeysCollector({ postProcess: 'other' })).toMatchObject({
      postProcess: ['other', 'usedKeysCollector'],
      postProcessPassResolved: true,
    })
  })
})
