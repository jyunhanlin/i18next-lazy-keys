'use client'

import { useTranslation } from 'react-i18next'

export function Streamed() {
  const { t } = useTranslation()
  return (
    <section>
      <h2>{t('streamedTitle')}</h2>
    </section>
  )
}
