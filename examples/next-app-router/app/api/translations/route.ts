import { type NextRequest, NextResponse } from 'next/server'
import { resources } from '../../i18n/resources'

/** loadKeys endpoint: ?lang=ja&ns=translation&key=a&key=b → { a: '…', b: '…' } (only keys it has). */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const bundle = resources[params.get('lang') ?? '']?.[params.get('ns') ?? '']
  const out: Record<string, string> = {}
  for (const key of params.getAll('key')) {
    const value = bundle?.[key]
    if (typeof value === 'string') out[key] = value
  }
  return NextResponse.json(out)
}
