import { NextRequest, NextResponse } from 'next/server'
import { boardFor } from '@/lib/arrivalops/board'
import { ctxNow, takeAnnouncements } from '@/lib/arrivalops/store'

export const dynamic = 'force-dynamic'

// Polled by the staff screen. With call-outs on (?speak=1) it returns cases nobody has acted on within the
// call-out delay, once each, so the counter tablet can say them out loud. Without, nothing is marked announced.
export function POST(request: NextRequest) {
  const { boardId } = boardFor(request)
  const speaking = request.nextUrl.searchParams.get('speak') === '1'
  return NextResponse.json({ announce: takeAnnouncements(ctxNow(), boardId, speaking).map((c) => ({ caseId: c.id })) })
}
