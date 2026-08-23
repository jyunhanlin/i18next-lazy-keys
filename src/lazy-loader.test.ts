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
})
