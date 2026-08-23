import type { i18n, InitOptions } from 'i18next'

export interface RequestInstanceOptions extends Omit<InitOptions, 'lng'> {
  lng: string
}

/**
 * A per-request i18next instance for SSR.
 *
 * Shares the parent's resource store and backend (already-loaded languages are not fetched
 * again) but owns its language and translator — so `t()` never sees another request's language,
 * and `usedKeysCollector` can attribute keys to this request. Same idea as `req.i18n` in
 * i18next-http-middleware.
 *
 * Runs on: server render, once per request — from a Server Component or the SSR pass of a
 * Client Component; both are fine, this module draws no boundary.
 */
export const createRequestInstance = async (
  parent: i18n,
  { lng, ...options }: RequestInstanceOptions,
): Promise<i18n> => {
  const clone = parent.cloneInstance({ ...options, lng })
  // cloneInstance() starts loading `lng` but only reports back through a callback;
  // changeLanguage() returns a promise and is a no-op for languages already in the store.
  await clone.changeLanguage(lng)
  return clone
}
