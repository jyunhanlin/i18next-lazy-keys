'use client'

import type { i18n } from 'i18next'
import { createInitialStoreScriptFlusher } from 'i18next-lazy-keys/react'
import { useServerInsertedHTML } from 'next/navigation'
import { type ReactNode, use, useState } from 'react'
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

  // Next.js runs this callback on every flush of the streamed document. Each call returns a
  // <script> with only the keys used since the last flush (null when nothing is new), so keys of
  // late <Suspense> boundaries arrive just before React hydrates those boundaries. The client's
  // lazy loader adds every chunk to its store as it arrives (followInitialStore).
  // useState: one flusher per request, created after use() resolved.
  const [flush] = useState(() => createInitialStoreScriptFlusher({ i18n }))
  useServerInsertedHTML(flush)

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
