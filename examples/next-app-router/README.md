# Next.js App Router example

A minimal Next.js 16 App Router app that uses `i18next-lazy-keys` from Client Components:

- the server renders each request with its own i18next instance (`createRequestInstance`),
- `<InitialStoreScript>` inlines only the keys that render used,
- the browser starts from that store and fetches every other key on first use (`createLazyLoader`).

## Run it

```bash
# from the repository root: build the library, because the example installs it from ../..
pnpm build

cd examples/next-app-router
pnpm install          # run again after every library rebuild (file: dependency = a copy)
pnpm build && pnpm start
# open http://localhost:3000/en  (or /ja)
```

## Where things are

| File | Runs on | What it does |
| --- | --- | --- |
| `app/[lng]/layout.tsx` | server (Server Component) | Root layout. Passes only the `lng` string to `<I18nProvider>`. `force-dynamic` so the page streams. |
| `app/i18n/provider.tsx` | server SSR pass + browser | **The two answers.** Gets the per-request instance during SSR, places `<InitialStoreScript>`. |
| `app/i18n/server.ts` | server | Root instance (all languages, `usedKeysCollector`) and `createRequestI18n(lng)`. |
| `app/i18n/client.ts` | browser | The single client instance: `readInitialStore()` + `createLazyLoader()`. |
| `app/api/translations/route.ts` | server | The `loadKeys` endpoint. |
| `app/[lng]/page.tsx` | server | Three cases: shell, client-only dialog, streamed section. |
| `proxy.ts` | server | Redirects `/` to `/en`. |

## 1. Getting the per-request instance in a Client Component's SSR pass

`createRequestInstance()` is async, and a Client Component cannot `await`. So the provider `use()`s a promise. Two rules make that work:

1. **Create the promise in one component, suspend on it in another.** A component that suspends before it mounts loses its state. If it created the promise itself, every retry would create a new promise and a new clone. `I18nProvider` creates the promise once in a `useState` initializer; `Inner` calls `use(promise)`.
2. **Import the server module inside a `typeof window === 'undefined'` branch, with a dynamic `import()`.** The bundler removes that branch from the client build, so `server.ts` and the full language packs never reach the browser.

```tsx
const [source] = useState(() =>
  typeof window === 'undefined'
    ? import('./server').then((m) => m.createRequestI18n(lng)) // server: per-request clone
    : getClientI18n(lng),                                      // browser: one instance
)
```

Check that the language packs stay on the server. Every value of the `neverUsed` key contains `NEVER_USED_SENTINEL`:

```bash
grep -rl NEVER_USED_SENTINEL .next/static | wc -l   # expect 0
```

## 2. Where `<InitialStoreScript>` goes

Inside `useServerInsertedHTML`, in the same component that has the resolved instance. Next.js calls that callback on **every flush** of the streamed HTML, so a `useRef` flag returns the script only on the first flush. Without the flag, the HTML gets one copy of the store per flush.

```tsx
const inserted = useRef(false)
useServerInsertedHTML(() => {
  if (inserted.current) return null
  inserted.current = true
  return <InitialStoreScript i18n={i18n} />
})
```

The first flush happens after the shell has rendered, so the shell's keys are recorded. The script lands in `<head>`, before the client bundle runs, and `getClientI18n()` reads it during hydration.

The client instance must finish `init()` before the first client render returns, so `client.ts` sets `initAsync: false`. If `init()` is asynchronous, the first render has no translations and hydration fails.

## What happens to each kind of key

Verified with `next start` and `next dev` on Next.js 16.4.5, i18next 26.7, and react-i18next 17.1:

| Key | In the inline store? | In the browser |
| --- | --- | --- |
| Shell (`title`, `greeting`, …) | yes | Hydrates without a mismatch. |
| `description` on `/ja` (ja does not have it) | yes, as the `en` value | Resolves through `fallbackLng`. No mismatch. |
| `t('item', { count: 3 })` (plural) | yes, as `item_other` | Hydrates without a mismatch. No request. |
| `dialogBody` (client-only UI) | no | One `/api/translations` request when you open the dialog. To ship it up front instead, pass `extraKeys={['dialogBody']}`. |
| `streamedTitle` (inside `<Suspense>`, resolves after the first flush) | **no** | **Hydration mismatch** for that boundary. React renders it again on the client, it shows `''`, and the text appears after one request. |
| `neverUsed` | no | Never requested. |

## Known issues

- **Keys in `<Suspense>` boundaries that resolve after the first flush are not in the inline store.** These boundaries get a hydration mismatch, which React recovers from by rendering them again on the client. A workaround for now is to list those keys in `extraKeys`. The real fix is to send only the new keys on each flush and to let the client add later chunks to the store. That changes the public API and is not done yet.
- Switching language uses a full page load (`<a href>`). Client-side navigation to another `[lng]` would need a `changeLanguage()` call, and this example does not cover that.
