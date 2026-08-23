import { createInstance } from 'i18next'
import { pickResources } from './pick-resources'

const resources = {
  en: { translation: { hello: 'Hello', bye: 'Bye' }, seo: { title: 'Title' } },
  ja: { translation: { hello: 'こんにちは' } },
}

const create = async (lng: string) => {
  const instance = createInstance()
  await instance.init({ lng, fallbackLng: 'en', resources })
  return instance
}

describe('pickResources', () => {
  it('picks the given keys for every language in the fallback chain, skipping what is absent', async () => {
    const i18n = await create('ja')
    expect(pickResources(i18n, { keys: ['hello', { ns: 'seo', key: 'title' }, 'nope'] })).toEqual({
      ja: { translation: { hello: 'こんにちは' } },
      en: { translation: { hello: 'Hello' }, seo: { title: 'Title' } },
    })
  })

  it('honours an explicit language list', async () => {
    const i18n = await create('ja')
    expect(pickResources(i18n, { keys: ['hello'], languages: ['en'] })).toEqual({
      en: { translation: { hello: 'Hello' } },
    })
  })
})
