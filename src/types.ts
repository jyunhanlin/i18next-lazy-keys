import type { i18n } from 'i18next'

/** A translation key together with the namespace it resolved in. */
export interface UsedKey {
  ns: string
  key: string
}

/** `{ [language]: { [namespace]: { [key]: value } } }` — the shape i18next's `resources` option accepts. */
export type ResourceStore = Record<string, Record<string, Record<string, string>>>

/**
 * i18next's per-instance translator. Not part of i18next's public types, but present since v1
 * and handed to every postProcessor as its 4th argument. It is the only per-instance handle a
 * postProcessor receives, and `cloneInstance()` gives every clone its own — which is what lets
 * `usedKeysCollector` attribute keys to one request.
 */
export type TranslatorRef = object

export const getTranslator = (instance: i18n): TranslatorRef | undefined =>
  (instance as unknown as { translator?: TranslatorRef }).translator

export const firstNamespace = (ns: unknown, fallback = 'translation'): string => {
  if (typeof ns === 'string') return ns
  if (Array.isArray(ns) && typeof ns[0] === 'string') return ns[0]
  return fallback
}
