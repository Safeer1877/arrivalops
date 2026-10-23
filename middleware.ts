import { NextResponse, type NextRequest } from 'next/server'

// Live mode talks to a real Ring account and shows the shop's real orders, so its routes only answer requests
// made on the desk machine itself. The Host check also stops DNS-rebinding pages in the same browser from
// reaching them. The public replay demo has no Ring credentials, so there those routes don't exist at all.
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

const isLive = () => Boolean(process.env.RING_ACCESS_TOKEN || process.env.RING_REFRESH_TOKEN)

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ringOnly = pathname.startsWith('/api/ring/') || pathname === '/api/arrivalops/observe' || pathname.startsWith('/sample')
  if (!isLive()) {
    return ringOnly ? new NextResponse('Not found', { status: 404 }) : NextResponse.next()
  }
  const remoteAllowed = process.env.ARRIVALOPS_ALLOW_REMOTE === '1'
  if (!remoteAllowed && !LOOPBACK.test(request.headers.get('host') ?? '')) {
    return NextResponse.json({ error: 'Live mode only answers on the desk machine (localhost).' }, { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  runtime: 'nodejs',
  // The Ring webhook keeps its own shared-secret check and has to be reachable through a tunnel.
  matcher: ['/((?!_next/|replay/|models/|favicon|icon|api/webhook).*)'],
}
