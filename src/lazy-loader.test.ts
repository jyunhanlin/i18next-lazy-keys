import { createInstance } from 'i18next'
import { createLazyLoader, type LazyLoaderOptions, type LoadKeysArgs } from './lazy-loader'

const echo = async ({ keys }: LoadKeysArgs) =>
  Object.fromEntries(keys.filter((k) => k !== 'unknown').map((k) => [k, `${k}!`]))

const setup = async (overrides: Partial<LazyLoaderOptions> = {}) => {
  const loadKeys = vi.fn(echo)
  const i18n = createInstance().use(createLazyLoader({ loadKeys, ...overrides }))
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
  })
  return { i18n, loadKeys }
}

describe('createLazyLoader', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns missingValue first, then the fetched value', async () => {
    const { i18n, loadKeys } = await setup()
    expect(i18n.t('hello')).toBe('')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys).toHaveBeenCalledWith({
      language: 'en',
      namespace: 'translation',
      keys: ['hello'],
    })
    expect(i18n.t('hello')).toBe('hello!')
  })

  it('batches reports inside the throttle window and dedupes', async () => {
    const { i18n, loadKeys } = await setup()
    i18n.t('a')
    i18n.t('b')
    i18n.t('a')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys).toHaveBeenCalledTimes(1)
    expect(loadKeys.mock.calls[0][0].keys).toEqual(['a', 'b'])
  })

  it('splits a batch by chunkSize', async () => {
    const { i18n, loadKeys } = await setup({ chunkSize: 2 })
    i18n.t('a')
    i18n.t('b')
    i18n.t('c')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys.mock.calls.map((c) => c[0].keys)).toEqual([['a', 'b'], ['c']])
  })

  it('stores notFound(key) when loadKeys omits the key, and does not ask again', async () => {
    const { i18n, loadKeys } = await setup()
    i18n.t('unknown')
    await vi.advanceTimersByTimeAsync(100)
    expect(i18n.t('unknown')).toBe('unknown')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys).toHaveBeenCalledTimes(1)
  })

  it('never fetches <Trans> markup keys and returns them as-is', async () => {
    const { i18n, loadKeys } = await setup()
    expect(i18n.t('<0>hi</0> there')).toBe('<0>hi</0> there')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys).not.toHaveBeenCalled()
  })

  it('releases keys after a failed load so the next report retries', async () => {
    const onError = vi.fn()
    const { i18n, loadKeys } = await setup({ onError })
    loadKeys.mockRejectedValueOnce(new Error('boom'))
    i18n.t('hello')
    await vi.advanceTimersByTimeAsync(100)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(i18n.t('hello')).toBe('')
    await vi.advanceTimersByTimeAsync(100)
    expect(loadKeys).toHaveBeenCalledTimes(2)
    expect(i18n.t('hello')).toBe('hello!')
  })

  it('emits "added" on the store so react-i18next (bindI18nStore: "added") re-renders', async () => {
    const { i18n } = await setup()
    const added = vi.fn()
    i18n.store.on('added', added)
    i18n.t('hello')
    await vi.advanceTimersByTimeAsync(100)
    expect(added).toHaveBeenCalledWith('en', 'translation', { hello: 'hello!' })
  })

  describe('on languageChanged', () => {
    const byLanguage = async ({ language, keys }: LoadKeysArgs) =>
      Object.fromEntries(keys.map((k) => [k, `${k}@${language}`]))

    it('refetches every known key for the new language — fallbackLng would otherwise hide the miss', async () => {
      const { i18n, loadKeys } = await setup()
      loadKeys.mockImplementation(byLanguage)
      i18n.t('hello')
      await vi.advanceTimersByTimeAsync(100)
      expect(i18n.t('hello')).toBe('hello@en')

      await i18n.changeLanguage('ja')
      expect(i18n.t('hello')).toBe('hello@en') // served by fallbackLng, so no missingKey fires
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys).toHaveBeenLastCalledWith({
        language: 'ja',
        namespace: 'translation',
        keys: ['hello'],
      })
      expect(i18n.t('hello')).toBe('hello@ja')
    })

    it('leaves keys the backend lacks in the new language on fallback text, and asks only once', async () => {
      const { i18n, loadKeys } = await setup()
      loadKeys.mockImplementation(byLanguage)
      i18n.t('hello')
      await vi.advanceTimersByTimeAsync(100)

      loadKeys.mockImplementation(async () => ({}))
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      expect(i18n.t('hello')).toBe('hello@en')
      i18n.t('hello')
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys).toHaveBeenCalledTimes(2) // en once, ja once
    })

    it('does nothing for the initial language or a no-op changeLanguage', async () => {
      const loadKeys = vi.fn(byLanguage)
      const i18n = createInstance().use(createLazyLoader({ loadKeys }))
      await i18n.init({
        lng: 'ja',
        fallbackLng: 'en',
        resources: { en: { translation: { hello: 'Hello' } } },
      })
      await vi.advanceTimersByTimeAsync(100)
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys).not.toHaveBeenCalled()
      expect(i18n.t('hello')).toBe('Hello')
    })

    it('flattens nested resources with keySeparator', async () => {
      const loadKeys = vi.fn(byLanguage)
      const i18n = createInstance().use(createLazyLoader({ loadKeys }))
      await i18n.init({
        lng: 'en',
        fallbackLng: 'en',
        resources: { en: { translation: { nav: { home: 'Home' } } } },
      })
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys).toHaveBeenCalledWith({
        language: 'ja',
        namespace: 'translation',
        keys: ['nav.home'],
      })
      expect(i18n.t('nav.home')).toBe('nav.home@ja')
    })

    it('does not ask again for a language it already fetched when switching back', async () => {
      const { i18n, loadKeys } = await setup()
      loadKeys.mockImplementation(byLanguage)
      i18n.t('hello')
      await vi.advanceTimersByTimeAsync(100)
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      await i18n.changeLanguage('en')
      await vi.advanceTimersByTimeAsync(100)
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys.mock.calls.map((c) => c[0].language)).toEqual(['en', 'ja'])
      expect(i18n.t('hello')).toBe('hello@ja')
    })

    it('can be turned off', async () => {
      const { i18n, loadKeys } = await setup({ refetchOnLanguageChange: false })
      i18n.t('hello')
      await vi.advanceTimersByTimeAsync(100)
      await i18n.changeLanguage('ja')
      await vi.advanceTimersByTimeAsync(100)
      expect(loadKeys).toHaveBeenCalledTimes(1)
    })
  })
})
