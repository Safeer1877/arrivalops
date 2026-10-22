import { NextResponse } from 'next/server'
import { takeAnnouncements } from '@/lib/arrivalops/store'

export const dynamic = 'force-dynamic'

// Polled by the staff screen. Returns cases nobody has acted on for 45 s, once each, so the counter
// device can announce them out loud.
export function POST() {
  return NextResponse.json({ announce: takeAnnouncements().map((c) => ({ caseId: c.id })) })
}
