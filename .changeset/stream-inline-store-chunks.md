---
'i18next-lazy-keys': minor
---

Stream the inline store per flush. The inline script now pushes a chunk onto `window.__I18N_LAZY_KEYS_STORE__` (a queue) instead of assigning one object, and `readInitialStore()` merges every chunk pushed so far.

New: `createInitialStoreFlusher()` and `createInitialStoreScriptFlusher()` (`i18next-lazy-keys/react`) return only the keys used since the last call, for `useServerInsertedHTML`. `followInitialStore()` adds chunks that arrive after `init()` to the store. `createLazyLoader()` calls it by default; turn it off with `followInitialStore: false`, or pass `{ globalKey }`. A late `<Suspense>` boundary now finds its keys in the store when it hydrates.
