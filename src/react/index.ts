import { createElement, type ReactElement } from 'react'
import {
  buildInitialStoreScript,
  createInitialStoreFlusher,
  type InitialStoreOptions,
} from '../initial-store'

export interface InitialStoreScriptProps extends InitialStoreOptions {
  id?: string
  nonce?: string
}

/**
 * `<script>` that inlines the translations this render used. Render it once, after the app
 * tree has rendered — e.g. from `useServerInsertedHTML()` in a Next.js App Router layout.
 *
 * Runs on: server render. Deliberately not a `'use client'` boundary: `i18n` is a class instance
 * and cannot be serialized across one. Render it from a Server Component or from inside an
 * already-client subtree; both work.
 */
export const InitialStoreScript = ({
  id = 'i18next-lazy-keys-store',
  nonce,
  ...options
}: InitialStoreScriptProps): ReactElement =>
  createElement('script', {
    id,
    nonce,
    dangerouslySetInnerHTML: { __html: buildInitialStoreScript(options) },
  })

/**
 * For streamed HTML: returns a function that gives a `<script>` with the keys used since the
 * last call, or `null` when there is nothing new. Pass it straight to Next.js:
 * `useServerInsertedHTML(flush)` — Next.js calls it on every flush, so keys used in late
 * `<Suspense>` boundaries reach the browser before React hydrates those boundaries.
 * Create one per request (e.g. in a `useState` initializer). No `id`: one element per flush.
 *
 * Runs on: server render.
 */
export const createInitialStoreScriptFlusher = ({
  nonce,
  ...options
}: Omit<InitialStoreScriptProps, 'id'>): (() => ReactElement | null) => {
  const flush = createInitialStoreFlusher(options)
  return () => {
    const script = flush()
    return script === null
      ? null
      : createElement('script', { nonce, dangerouslySetInnerHTML: { __html: script } })
  }
}

export { DEFAULT_GLOBAL_KEY, readInitialStore } from '../initial-store'
