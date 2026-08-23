import { defineConfig } from 'vitest/config'

// `I18NEXT_VERSION=23 vitest run` runs the same suite against i18next 23 (the oldest supported peer).
const i18nextAlias = process.env.I18NEXT_VERSION === '23' ? { i18next: 'i18next-v23' } : {}

export default defineConfig({
  resolve: { alias: i18nextAlias },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/react/index.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
