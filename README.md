# i18next-lazy-keys

Key-level lazy loading for [i18next](https://www.i18next.com/). Ship only the translations a render actually used; fetch everything else on first use.

> **Status: pre-release (0.0.x).** The API may change. Built for a Next.js App Router site that serves ~20 namespaces and thousands of keys per language, where namespace-sized bundles were either too big or missing keys.

## The idea

```
server  root instance loads full language packs once
        └─ per request: createRequestInstance() ──► render ──► usedKeysCollector records every key t() returned
                                                              └─ <InitialStoreScript> inlines just those keys

client  readInitialStore() seeds `resources`  ──► first paint has everything SSR used, nothing more
        createLazyLoader() fetches any other key the moment t() asks for it (batched, deduped)
```

Two things i18next itself does not give you:

- **Per-key loading.** Backends load `(language, namespace)`; this plugin loads `(language, namespace, key[])` through a `loadKeys` function you supply — any HTTP API, KV store, or file.
- **Exact SSR payloads.** A postProcessor records which keys resolved on *this* request's instance, so the inlined store is exactly what the HTML needs.

## Who this is for

The deciding question is **where your `t()` calls run**, not how big the app is.

- **You want this when translated UI lives in Client Components** — `useTranslation()` / `<Trans>` everywhere, rendered on the server and then hydrated in the browser. Typical for interaction-heavy apps, Redux-style SPAs moved to the App Router, and Pages Router apps. The browser must hold the same translations the server used, and you want first paint to carry exactly those keys and nothing more.
- **You mostly do not need it when the app is Server Components first.** `t()` runs only on the server and no resources ship to the browser, so the inline store and the lazy loader have nothing to do. `createRequestInstance()` is still useful there: one i18next instance per request instead of a shared one.

### Import it from Server Components or Client Components

The package draws no React Server Components boundary. Every module is a *shared* module: no hooks, no context, no event handlers, no browser API at module top level. Import it from a Server Component and it stays on the server; import it from a Client Component and it joins the client graph. That is why there is no `'use client'` and no `import 'server-only'` anywhere — adding either would break one of those two paths. In particular `<InitialStoreScript i18n={...}>` takes a class instance as a prop, which cannot cross a server→client boundary, so it must not be a boundary itself. The "Runs on" column below says where each export is meant to execute.

## Install

```bash
pnpm add i18next-lazy-keys i18next
```

Peer: `i18next >= 23` (tested against 23.10 and 26.x). `react` is an optional peer, only for `i18next-lazy-keys/react`.

## Usage

### Server (once per process)

```ts
import i18next from 'i18next'
import { usedKeysCollector, withUsedKeysCollector } from 'i18next-lazy-keys'

export const root = i18next.createInstance().use(YourFullPackBackend).use(usedKeysCollector)
await root.init(withUsedKeysCollector({ fallbackLng: 'en', ns: ['translation'] }))
```

`usedKeysCollector` lives in i18next's **global** postProcessor registry — register it once at module level, never per request.

### Server (per request)

```tsx
import { createRequestInstance } from 'i18next-lazy-keys'
import { InitialStoreScript } from 'i18next-lazy-keys/react'

const i18n = await createRequestInstance(root, { lng: 'ja' }) // shares store + backend, owns language + translator

// ...render with <I18nextProvider i18n={i18n}>...

// after the tree has rendered (Next.js: inside useServerInsertedHTML)
<InitialStoreScript i18n={i18n} extraKeys={['age_verify_title']} />
// → <script>window["__I18N_LAZY_KEYS_STORE__"]={"ja":{"translation":{...}},"en":{...}};</script>
```

Why a per-request instance: one shared instance means `changeLanguage()` races between concurrent requests, and a global postProcessor cannot tell requests apart. `createRequestInstance()` is `cloneInstance()` + `changeLanguage()` — the same thing `i18next-http-middleware` does for `req.i18n`.

### Client

```ts
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { createLazyLoader, readInitialStore } from 'i18next-lazy-keys'

await i18next
  .use(initReactI18next)
  .use(
    createLazyLoader({
      loadKeys: async ({ language, namespace, keys }) => {
        const url = new URL('/translations', location.origin)
        url.searchParams.set('lang', language)
        keys.forEach((k) => url.searchParams.append('key', k))
        return (await fetch(url)).json() // { key: value }
      },
    }),
  )
  .init({
    resources: readInitialStore(),
    partialBundledLanguages: true,
    fallbackLng: 'en',
    react: { bindI18nStore: 'added' }, // re-render when lazy keys arrive
  })
```

While a key is loading `t()` returns `''` (configurable via `missingValue`), so users never see raw keys.

## API

"Server render" = during SSR/RSC on the server, inside a Server Component or the server pass of a Client Component. "Browser" = the client instance after hydration.

| Export | What it does | Runs on |
| --- | --- | --- |
| `usedKeysCollector` | postProcessor; records `{ ns, key }` per instance | server render (register once, module level) |
| `withUsedKeysCollector(initOptions)` | adds it to `postProcess` + sets `postProcessPassResolved: true` (exact attribution) | server render (root init) |
| `getUsedKeys(i18n)` / `clearUsedKeys(i18n)` | read / reset the record for one instance | server render |
| `createRequestInstance(root, { lng, ...initOptions })` | per-request clone, resolved when `lng` is loaded | server render (per request) |
| `pickResources(i18n, { keys, languages?, defaultNS? })` | copy just those keys out of the store, `resources`-shaped | both |
| `buildInitialStore(opts)` / `buildInitialStoreScript(opts)` | used keys + `extraKeys` → store object / inline `<script>` source | server render |
| `readInitialStore(globalKey?)` | the store the server inlined | browser |
| `createLazyLoader({ loadKeys, throttleMs?, chunkSize?, missingValue?, notFound?, skipKey?, onError?, refetchOnLanguageChange? })` | 3rdParty plugin: key-level lazy loading; refetches known keys after `changeLanguage()` | browser (client instance) |
| `serializeForScript(value)` | JSON that cannot break out of a `<script>` | both |
| `i18next-lazy-keys/react` → `InitialStoreScript` | React element for the inline script | server render (from `useServerInsertedHTML` or a Server Component) |

## Roadmap

- [ ] `loadGroups` — optional "key in namespace X is missing → fetch all of X" for coarse prefetch.
- [ ] Plural keys: decide how `saveMissingPlurals` interacts with `loadKeys`.
- [ ] Next.js App Router example.

## License

MIT
