import { NextRequest, NextResponse } from 'next/server'
import { ActionError } from '@/lib/arrivalops/reconcile'
import { dispatch, view } from '@/lib/arrivalops/store'
import { MODEL_ID } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    ...view(),
    mode: {
      live: Boolean(process.env.RING_ACCESS_TOKEN || process.env.RING_REFRESH_TOKEN),
      visionModel: MODEL_ID,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(dispatch(await request.json()))
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('ArrivalOps action failed:', err)
    return NextResponse.json({ error: 'Something went wrong; nothing was changed.' }, { status: 500 })
  }
}
