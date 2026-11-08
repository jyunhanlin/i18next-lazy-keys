// Shared by the server root, the client instance, and the translations route.
export const languages = ['en', 'ja'] as const
export type Language = (typeof languages)[number]
export const fallbackLng: Language = 'en'
export const defaultNS = 'translation'

export const isLanguage = (value: string): value is Language =>
  (languages as readonly string[]).includes(value)
