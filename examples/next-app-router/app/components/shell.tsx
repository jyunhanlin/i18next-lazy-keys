'use client'

import { useTranslation } from 'react-i18next'

export function Shell() {
  const { t, i18n } = useTranslation()
  const other = i18n.language === 'ja' ? 'en' : 'ja'
  return (
    <header>
      <h1>{t('title')}</h1>
      <p>{t('greeting', { name: 'i18next' })}</p>
      {/* Missing in ja: resolves through fallbackLng, so the inline store carries the en value. */}
      <p>{t('description')}</p>
      {/* Plural: the server records `item_other`, the key the store actually has. */}
      <p>{t('item', { count: 3 })}</p>
      {/* Full page load on purpose: the new language is server-rendered with its own inline store. */}
      <a href={`/${other}`}>{t('switchLanguage')}</a>
    </header>
  )
}
