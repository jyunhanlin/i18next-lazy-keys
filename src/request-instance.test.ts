import { createInstance, type BackendModule } from 'i18next'
import { createRequestInstance } from './request-instance'

const data: Record<string, Record<string, Record<string, string>>> = {
  en: { translation: { hello: 'Hello' } },
  ja: { translation: { hello: 'こんにちは' } },
}

describe('createRequestInstance', () => {
  it('gives each request its own language without touching the parent', async () => {
    const root = createInstance()
    await root.init({ lng: 'en', fallbackLng: 'en', resources: data })

    const ja = await createRequestInstance(root, { lng: 'ja' })
    const en = await createRequestInstance(root, { lng: 'en' })

    expect(ja.t('hello')).toBe('こんにちは')
    expect(en.t('hello')).toBe('Hello')
    expect(root.language).toBe('en')
    expect(ja.store).toBe(root.store)
  })

  it('loads a language the parent has not seen yet, once, through the shared backend', async () => {
    const reads: string[] = []
    const backend: BackendModule = {
      type: 'backend',
      init() {},
      read(lng, ns, callback) {
        reads.push(lng)
        callback(null, data[lng]?.[ns] ?? {})
      },
    }
    const root = createInstance().use(backend)
    await root.init({ lng: 'en', fallbackLng: 'en' })
    expect(reads).toEqual(['en'])

    const first = await createRequestInstance(root, { lng: 'ja' })
    const second = await createRequestInstance(root, { lng: 'ja' })

    expect(first.t('hello')).toBe('こんにちは')
    expect(second.t('hello')).toBe('こんにちは')
    expect(reads).toEqual(['en', 'ja'])
  })
})
