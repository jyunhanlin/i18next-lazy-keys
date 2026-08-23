import { createElement, type ReactElement } from 'react'
import { buildInitialStoreScript, type InitialStoreOptions } from '../initial-store'

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

export { DEFAULT_GLOBAL_KEY, readInitialStore } from '../initial-store'
