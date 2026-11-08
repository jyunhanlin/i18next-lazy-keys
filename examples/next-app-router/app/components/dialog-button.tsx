'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function DialogButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button type="button" onClick={() => setOpen(true)}>
        {t('openDialog')}
      </button>
      {/* Pass extraKeys={['dialogBody']} to <InitialStoreScript> to ship it up front instead. */}
      {open && <p role="dialog">{t('dialogBody')}</p>}
    </section>
  )
}
