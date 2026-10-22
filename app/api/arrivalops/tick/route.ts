import { NextRequest, NextResponse } from 'next/server'
import { boardFor } from '@/lib/arrivalops/board'
import { ctxNow, takeAnnouncements } from '@/lib/arrivalops/store'

export const dynamic = 'force-dynamic'

// Polled by the staff screen. Returns cases nobody has acted on for 45 s, once each, so the counter
// device can announce them out loud.
export function POST(request: NextRequest) {
  const { boardId } = boardFor(request)
  return NextResponse.json({ announce: takeAnnouncements(ctxNow(), boardId).map((c) => ({ caseId: c.id })) })
}
