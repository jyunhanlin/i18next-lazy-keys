import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { isLanguage } from '../i18n/options'
import { I18nProvider } from '../i18n/provider'

// Render per request. Without this the page is prerendered at build time and the
// <Suspense> section never streams.
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params
  if (!isLanguage(lng)) notFound()
  return (
    <html lang={lng}>
      <body>
        {/* Server Component → Client Component: only the language string crosses the boundary. */}
        <I18nProvider lng={lng}>{children}</I18nProvider>
      </body>
    </html>
  )
}
