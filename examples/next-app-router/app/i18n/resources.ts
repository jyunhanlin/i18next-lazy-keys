// Full language packs. Server only: imported by server.ts and the translations route.
// If this file ever reaches a client chunk, every translation ships to the browser —
// the README shows how to check the build output for that.
import en from '../../locales/en/translation.json'
import ja from '../../locales/ja/translation.json'

export const resources: Record<string, Record<string, Record<string, string>>> = {
  en: { translation: en },
  ja: { translation: ja },
}
