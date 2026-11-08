import { type NextRequest, NextResponse } from 'next/server'
import { fallbackLng } from './app/i18n/options'

// `/` → `/en`. app/[lng]/layout.tsx is the root layout, so there is no app/page.tsx to redirect from.
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL(`/${fallbackLng}`, request.url))
}

export const config = { matcher: '/' }
