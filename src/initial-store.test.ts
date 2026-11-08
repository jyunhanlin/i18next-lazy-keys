import { createInstance } from 'i18next'
import {
  buildInitialStoreScript,
  createInitialStoreFlusher,
  DEFAULT_GLOBAL_KEY,
  followInitialStore,
  readInitialStore,
} from './initial-store'
import { usedKeysCollector, withUsedKeysCollector } from './used-keys-collector'

const resources = {
  en: { translation: { hello: 'Hello', bye: 'Bye', modal: 'Modal' }, seo: { title: 'Title' } },
}

const createI18n = async () => {
  const i18n = createInstance().use(usedKeysCollector)
  await i18n.init(withUsedKeysCollector({ lng: 'en', resources }))
  return i18n
}

/** Run an inline script the way the browser would: as global code. */
const runScript = (source: string) => new Function(source)()

const globals = window as unknown as Record<string, unknown>

describe('initial store', () => {
  beforeEach(() => {
    delete globals[DEFAULT_GLOBAL_KEY]
  })

  it('inlines only the keys the instance used plus extraKeys, as one pushed chunk', async () => {
    const i18n = await createI18n()
    i18n.t('hello')

    const script = buildInitialStoreScript({ i18n, extraKeys: ['modal'] })
    expect(script).toBe(
      '(window["__I18N_LAZY_KEYS_STORE__"]=window["__I18N_LAZY_KEYS_STORE__"]||[]).push({"en":{"translation":{"hello":"Hello","modal":"Modal"}}});',
    )
  })

  it('readInitialStore() merges every chunk the scripts pushed', async () => {
    const root = await createI18n()
    const first = root.cloneInstance()
    const second = root.cloneInstance()
    first.t('hello')
    second.t('title', { ns: 'seo' })
    runScript(buildInitialStoreScript({ i18n: first }))
    runScript(buildInitialStoreScript({ i18n: second }))

    expect(readInitialStore()).toEqual({
      en: { translation: { hello: 'Hello' }, seo: { title: 'Title' } },
    })
  })

  it('createInitialStoreFlusher() sends each key once: new keys per call, null when none', async () => {
    const i18n = await createI18n()
    const flush = createInitialStoreFlusher({ i18n, extraKeys: ['modal'] })
    i18n.t('hello')

    expect(flush()).toBe(
      '(window["__I18N_LAZY_KEYS_STORE__"]=window["__I18N_LAZY_KEYS_STORE__"]||[]).push({"en":{"translation":{"hello":"Hello","modal":"Modal"}}});',
    )
    expect(flush()).toBeNull()

    i18n.t('bye')
    i18n.t('hello')
    expect(flush()).toBe(
      '(window["__I18N_LAZY_KEYS_STORE__"]=window["__I18N_LAZY_KEYS_STORE__"]||[]).push({"en":{"translation":{"bye":"Bye"}}});',
    )
  })

  it('createInitialStoreFlusher() counts keys with no value as sent', async () => {
    const i18n = await createI18n()
    const flush = createInitialStoreFlusher({ i18n })
    i18n.t('missing')
    expect(flush()).toBeNull()
    i18n.t('hello')
    expect(flush()).toContain('{"en":{"translation":{"hello":"Hello"}}}')
  })

  describe('followInitialStore()', () => {
    const chunkScript = async (key: string) => {
      const server = (await createI18n()).cloneInstance()
      server.t(key)
      return buildInitialStoreScript({ i18n: server })
    }
    const createClient = async () => {
      const client = createInstance()
      await client.init({ lng: 'en', resources: {}, partialBundledLanguages: true })
      return client
    }

    it('applies chunks already pushed, then chunks pushed later, until stopped', async () => {
      runScript(await chunkScript('hello'))
      const client = await createClient()

      const stop = followInitialStore(client)
      expect(client.t('hello')).toBe('Hello')

      runScript(await chunkScript('bye'))
      expect(client.t('bye')).toBe('Bye')

      stop()
      runScript(await chunkScript('modal'))
      expect(client.t('modal')).toBe('modal')
      expect(readInitialStore()?.en.translation.modal).toBe('Modal')
    })

    it('stops each follower on its own, in any order', async () => {
      const a = await createClient()
      const b = await createClient()
      const stopA = followInitialStore(a)
      const stopB = followInitialStore(b)

      stopA()
      runScript(await chunkScript('hello'))
      expect(a.t('hello')).toBe('hello')
      expect(b.t('hello')).toBe('Hello')

      stopB()
      runScript(await chunkScript('bye'))
      expect(a.t('bye')).toBe('bye')
      expect(b.t('bye')).toBe('bye')
    })

    it('catches chunks pushed after it, even when no script ran before', async () => {
      const client = await createClient()
      followInitialStore(client)
      runScript(await chunkScript('hello'))
      expect(client.t('hello')).toBe('Hello')
    })
  })

  it('readInitialStore() is undefined when no script ran', () => {
    expect(readInitialStore()).toBeUndefined()
    expect(readInitialStore('nope')).toBeUndefined()
  })
})
