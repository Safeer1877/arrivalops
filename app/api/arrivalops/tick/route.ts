import { NextRequest, NextResponse } from 'next/server'
import { postTick } from '@/lib/arrivalops/api'
import { boardFor } from '@/lib/arrivalops/board'
import '@/lib/arrivalops/diskPersistence'

export const dynamic = 'force-dynamic'

// Polled by the staff screen; see postTick.
export function POST(request: NextRequest) {
  const { status, body } = postTick(boardFor(request).boardId, request.nextUrl.searchParams.get('speak') === '1')
  return NextResponse.json(body, { status })
}
