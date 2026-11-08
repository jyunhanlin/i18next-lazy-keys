# i18next-lazy-keys

Key-level lazy loading for [i18next](https://www.i18next.com/). Ship only the translations a render actually used; fetch everything else on first use.

> **Status: pre-release (0.0.x).** The API may change. Built for a Next.js App Router site that serves ~20 namespaces and thousands of keys per language, where namespace-sized bundles were either too big or missing keys.

## The idea

```
server  root instance loads full language packs once
        └─ per request: createRequestInstance() ──► render ──► usedKeysCollector records every key t() returned
                                                              └─ inline <script> chunks carry just those keys (one per flush when streaming)

client  readInitialStore() seeds `resources`  ──► first paint has everything SSR used, nothing more
        chunks streamed in later are added to the store before their boundary hydrates
        createLazyLoader() fetches any other key the moment t() asks for it (batched, deduped)
        … and refetches every known key when the language changes (fallbackLng would hide the miss)
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

// after the tree has rendered, once
<InitialStoreScript i18n={i18n} extraKeys={['age_verify_title']} />
// → <script>(window["__I18N_LAZY_KEYS_STORE__"]=…||[]).push({"ja":{"translation":{...}},"en":{...}});</script>
```

#### Streamed HTML (Next.js App Router)

With streaming, `<Suspense>` boundaries render after the first bytes are sent, so one script cannot hold every key. Use a **flusher** instead: each call returns a `<script>` with only the keys used since the last call, or `null` when there is nothing new. Next.js calls `useServerInsertedHTML` on every flush, so pass the flusher straight to it:

```tsx
import { createInitialStoreScriptFlusher } from 'i18next-lazy-keys/react'

const [flush] = useState(() => createInitialStoreScriptFlusher({ i18n, nonce })) // one per request
useServerInsertedHTML(flush)
```

Each script pushes one chunk onto `window.__I18N_LAZY_KEYS_STORE__`. Next.js puts a flush's inserted HTML before that flush's content, so a late boundary's keys reach the browser before React hydrates the boundary. On the client, `createLazyLoader()` adds every chunk to the store as it arrives (see `followInitialStore` below). Without a React element, use `createInitialStoreFlusher()`, which returns the script source.

See [examples/next-app-router](examples/next-app-router) for a full App Router setup, including how a Client Component gets the per-request instance.

Why a per-request instance: one shared instance means `changeLanguage()` races between concurrent requests, and a global postProcessor cannot tell requests apart. `createRequestInstance()` is `cloneInstance()` + `changeLanguage()` — the same thing `i18next-http-middleware` does for `req.i18n`.

It is cheap: the clone shares the store and backend, and the collector keeps its record in a `WeakMap` keyed by the clone's translator, so it is garbage-collected with the request — no LRU or TTL to tune.

#### What the inline store contains

- The keys this request's `t()` calls returned — exactly those, in the namespace they resolved in.
- **For every language in `i18n.languages`** (current language + its `fallbackLng` chain). The browser resolves the same way the server did, so a key the server took from the fallback language must reach the browser too. Payload ≈ used keys × chain length; keep the chain short.
- Plus `extraKeys`: keys the server render cannot see — client-only UI such as modals, toasts, anything shown after an effect. Without them those keys load lazily after hydration and show `missingValue` (`''`) for one round-trip.
- `nonce` is passed through to the `<script>` for CSP. The payload goes through `serializeForScript()`, so a value containing `</script>` cannot break out of the tag.

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

Two things the client setup must get right:

- **`react.bindI18nStore: 'added'`.** Lazily loaded keys arrive through `addResourceBundle`, which emits `added` on the store. Without it nothing re-renders when they land.
- **Read the store before hydration.** `readInitialStore()` is synchronous; call it and `init()` before `hydrateRoot()`, and make sure the inline `<script>` sits in the HTML before your bundle runs — `useServerInsertedHTML` takes care of that in Next.js. Otherwise the first client render lacks keys the server had, and React reports a hydration mismatch.
- **Make `init()` synchronous when it runs during render.** The Next.js App Router has no `hydrateRoot()` call for you to put `init()` in front of, so the client instance is created during the first client render. Pass `initAsync: false` (i18next ≥ 24; `initImmediate: false` on 23), so `t()` has the store before that render returns. See [examples/next-app-router](examples/next-app-router).

### Express / Pages Router

`i18next-http-middleware` already hands you a per-request clone as `req.i18n`, so skip `createRequestInstance()`:

```ts
app.use(i18nextMiddleware.handle(root)) // root: .use(usedKeysCollector), init(withUsedKeysCollector(...))

// after rendering the page with req.i18n
html = html.replace('</head>', `<script>${buildInitialStoreScript({ i18n: req.i18n })}</script></head>`)
```

## How lazy loading behaves

`createLazyLoader()` is the client half. Its contract:

1. **First use.** `t('key')` for a key not in the store returns `missingValue(key)` (default `''`) and reports it. Reports within `throttleMs` (100) are batched per language and namespace, fetched with `loadKeys` in chunks of `chunkSize` (60), and written with `addResourceBundle` → react-i18next re-renders (needs `react.bindI18nStore: 'added'`).
2. **Once per key.** A key is requested at most once per language; concurrent renders asking for the same key share the request.
3. **Not found.** A key `loadKeys` did not return is stored as `notFound(key)` (default: the key itself) and never asked for again. Return only the keys you have; do not echo keys back.
4. **Errors.** If `loadKeys` rejects, `onError` is called, the keys are released, and they are retried the next time `t()` asks for them.
5. **`<Trans>` keys.** Keys that look like `<0>…</0>` markup (react-i18next using children as the key) are never fetched; `t()` returns them unchanged. Override with `skipKey`.
6. **Language change.** i18next only reports a key as missing when *no* language in the fallback chain has it. After `changeLanguage()`, keys the previous language loaded still resolve through `fallbackLng`, so nothing would be reported and the UI would stay on fallback text. The loader therefore refetches every key already in the store for the new language (`refetchOnLanguageChange`, default true). Keys the backend does not have in the new language are left out of the store, so the fallback keeps serving them. The initial language set by `init()` does not trigger this.
7. **Plurals.** With a `count`, i18next reports the suffixed keys (`key_one`, `key_other`, …) and that is what `loadKeys` receives. If your backend keeps one entry per key and handles plurals itself, set `saveMissingPlurals: false` in `init()`: the base key is reported instead, and i18next falls back to it for every count.
8. **Inline store chunks.** At `init()` the loader adds every chunk the server's inline scripts pushed, and keeps adding chunks that a streamed page sends later — so a late `<Suspense>` boundary finds its keys in the store when it hydrates, with no fetch. Turn it off with `followInitialStore: false`; pass `{ globalKey }` if the server used a custom one.

What the plugin changes on your instance at `init()`: follows the inline store (item 8); sets `saveMissing: true`; installs a no-op `missingKeyHandler` and a `parseMissingKeyHandler` that returns `missingValue(key)` — **only if you have not set your own**. If you have, yours win; `missingValue` then has no effect, because `parseMissingKeyHandler` is what decides what `t()` returns for a missing key.

## API

"Server render" = during SSR/RSC on the server, inside a Server Component or the server pass of a Client Component. "Browser" = the client instance after hydration.

| Export | What it does | Runs on |
| --- | --- | --- |
| `usedKeysCollector` | postProcessor; records `{ ns, key }` per instance | server render (register once, module level) |
| `withUsedKeysCollector(initOptions)` | adds it to `postProcess` + sets `postProcessPassResolved: true` (exact attribution) | server render (root init) |
| `getUsedKeys(i18n)` / `clearUsedKeys(i18n)` | read / reset the record for one instance | server render |
| `createRequestInstance(root, { lng, ...initOptions })` | per-request clone, resolved when `lng` is loaded | server render (per request) |
| `pickResources(i18n, { keys, languages?, defaultNS? })` | copy just those keys out of the store, `resources`-shaped | both |
| `buildInitialStore(opts)` / `buildInitialStoreScript(opts)` | used keys + `extraKeys` → store object / inline `<script>` source that pushes it as one chunk | server render |
| `createInitialStoreFlusher(opts)` | per request: `() => string \| null` — script source for the keys used since the last call; for streamed HTML | server render |
| `readInitialStore(globalKey?)` | every chunk the server pushed so far, merged | browser |
| `followInitialStore(i18n, globalKey?)` | adds pushed chunks to `i18n`, now and as they arrive; returns a stop function. `createLazyLoader()` calls it for you | browser (after `init()`) |
| `createLazyLoader({ loadKeys, throttleMs?, chunkSize?, missingValue?, notFound?, skipKey?, onError?, refetchOnLanguageChange?, followInitialStore? })` | 3rdParty plugin: key-level lazy loading; refetches known keys after `changeLanguage()`; follows the inline store | browser (client instance) |
| `serializeForScript(value)` | JSON that cannot break out of a `<script>` | both |
| `i18next-lazy-keys/react` → `InitialStoreScript` | React element for a one-shot inline script | server render (once, after the tree rendered) |
| `i18next-lazy-keys/react` → `createInitialStoreScriptFlusher(opts)` | per request: `() => ReactElement \| null` for `useServerInsertedHTML` | server render (every flush) |

## Roadmap

- [ ] `loadGroups` — optional "key in namespace X is missing → fetch all of X" for coarse prefetch.
- [x] Next.js App Router example: [examples/next-app-router](examples/next-app-router).

## Development

```bash
pnpm test              # vitest, i18next latest
pnpm test:i18next23    # same suite on i18next 23.10 (oldest supported peer)
pnpm check             # oxlint + oxfmt + tsc (also runs on pre-push)
pnpm build             # tsdown → dist/
```

## License

MIT
