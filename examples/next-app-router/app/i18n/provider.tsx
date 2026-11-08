'use client'

import type { i18n } from 'i18next'
import { InitialStoreScript } from 'i18next-lazy-keys/react'
import { useServerInsertedHTML } from 'next/navigation'
import { type ReactNode, use, useRef, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { getClientI18n } from './client'

/**
 * Gives Client Components an i18n instance on both passes:
 * - server (SSR pass of this Client Component): a per-request clone from createRequestInstance()
 * - browser: the single client instance, seeded from the inline store
 *
 * Split in two on purpose. createRequestInstance() is async, so the server branch has to
 * suspend on a promise. The component that creates the promise must not be the one that
 * suspends on it: a component that suspends before it mounts loses its state, and would
 * create a new promise (a new clone) on every retry. Outer creates it once; Inner suspends.
 */
export function I18nProvider({ lng, children }: { lng: string; children: ReactNode }) {
  const [source] = useState<Promise<i18n> | i18n>(() =>
    typeof window === 'undefined'
      ? // Dynamic import inside a `typeof window` branch: the bundler drops this branch from the
        // client build, so server.ts and the full language packs never reach the browser.
        import('./server').then((m) => m.createRequestI18n(lng))
      : getClientI18n(lng),
  )
  return <Inner source={source}>{children}</Inner>
}

function Inner({ source, children }: { source: Promise<i18n> | i18n; children: ReactNode }) {
  const i18n = source instanceof Promise ? use(source) : source

  // Next.js runs this callback on every flush of the streamed document. Return the script only
  // on the first one: by then the shell has rendered, so its keys are recorded. Keys used inside
  // <Suspense> boundaries that resolve later are NOT in this script — see the README.
  const inserted = useRef(false)
  useServerInsertedHTML(() => {
    if (inserted.current) return null
    inserted.current = true
    return <InitialStoreScript i18n={i18n} />
  })

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
