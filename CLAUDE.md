# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`i18next-lazy-keys` — an i18next plugin set for key-level lazy loading: a postProcessor that records the keys an SSR render used, a per-request instance helper, and a 3rdParty plugin that fetches missing keys on demand. Published to npm and GitHub Packages. First consumer: a Next.js App Router app that today does this by hand (collect used keys per request → inline → `missingKeyHandler` fetch).

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml`, CI uses `--frozen-lockfile`).

```bash
pnpm test              # vitest run, i18next latest (jsdom)
pnpm test:i18next23    # same suite against i18next 23.10.0 (oldest supported peer; alias in vitest.config.ts)
pnpm test:all          # both
pnpm test:coverage     # thresholds 80% in vitest.config.ts
pnpm build             # tsdown → dist (ESM + CJS + .d.ts), entries: src/index.ts, src/react/index.ts
pnpm check             # lint + format:check + typecheck — the pre-push hook runs this
```

Single test: `pnpm vitest run src/lazy-loader.test.ts -t "batches"`.

## Tooling notes (non-standard)

- Linter/formatter are **oxc**: `oxlint` (`.oxlintrc.json`, `correctness` = error) and `oxfmt` (`.oxfmtrc.json`: no semicolons, single quotes, width 100). Not ESLint/Prettier.
- `simple-git-hooks` installs a `pre-push` hook that runs `pnpm check`.
- Tests are colocated (`foo.ts` ↔ `foo.test.ts`), vitest `globals: true`.
- `src/react/index.ts` uses `createElement`, not JSX, so the build stays `.ts`-only.
- Both `pnpm test` and `pnpm test:i18next23` must pass — i18next 26 removed options that 23 had (e.g. `initImmediate`); do not use version-specific options in `src/`.
- **Shared modules, no RSC boundary — by design.** No `'use client'`, no `import 'server-only'`/`'client-only'`. Every module is a *shared* module (no hooks/context/handlers, no browser API at top level) so it can be imported from Server Components and Client Components alike. `<InitialStoreScript>` takes an `i18n` class instance as a prop, which cannot cross a server→client boundary, so it must stay boundary-free; `createRequestInstance`/`usedKeysCollector` are called from the SSR pass of `'use client'` modules in the first consumer, so `server-only` would break the build. Document where things run with the `Runs on:` JSDoc line and the README column instead.

## Architecture

```
src/
  used-keys-collector.ts  postProcessor + WeakMap<translator, Map<id, UsedKey>>; getUsedKeys / withUsedKeysCollector
  request-instance.ts     createRequestInstance = cloneInstance + await changeLanguage
  pick-resources.ts       store → { lng: { ns: { key: value } } } for a key list
  initial-store.ts        buildInitialStore / buildInitialStoreScript / readInitialStore (window global)
  lazy-loader.ts          3rdParty plugin: saveMissing + on('missingKey') → batch → loadKeys → addResourceBundle
  serialize.ts            JSON safe inside <script>
  react/index.ts          <InitialStoreScript> wrapper
```

## i18next internals this package leans on (verified against 23.10.0 and 26.4.0 source)

1. **postProcessors are global.** `i18n.use({ type: 'postProcessor' })` writes into one module-level registry shared by every instance — register once, never per request. Per-request scoping comes from the 4th `process()` argument, the **translator**, which `cloneInstance()` creates fresh per clone. `i18n.translator` is not in i18next's types; `types.ts#getTranslator` is the single place that reads it.
2. **`postProcessPassResolved: true`** makes i18next pass `options.i18nResolved.{usedKey, usedNS}` to postProcessors — exact attribution for `t(['a','b'])` fallbacks and `fallbackNS`. `withUsedKeysCollector()` sets it.
3. **`missingKey` event** is only emitted when `saveMissing: true`. The defaults for `missingKeyHandler` and `parseMissingKeyHandler` are `false`, not `undefined` — test truthiness, not `??=`. Without a `missingKeyHandler`, i18next falls through to `backendConnector.saveMissing()`, which writes `key: key` into the store and the key stops reporting as missing.
4. **`added` is emitted on `i18n.store`**, not on the instance (react-i18next's `bindI18nStore` listens there).
5. `cloneInstance()` shares `store`, `services`, and `backendConnector` state, so already-loaded languages are not fetched again; `changeLanguage()` on the clone resolves once `lng` is in the store.

## Releases

Changesets (`pnpm changeset`) for versions; publishing is tag-driven (`v*` → `release` job in `.github/workflows/pipeline.yml`) to npm (`i18next-lazy-keys`, with provenance) and GitHub Packages (`@jyunhanlin/i18next-lazy-keys`). Tags with a hyphen publish under the `next` dist-tag.
