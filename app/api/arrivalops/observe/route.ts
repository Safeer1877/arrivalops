import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordObservation } from '@/lib/arrivalops/store'
import { classifyFrame } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

const MAX_FRAME_BYTES = 1_500_000

const Body = z.object({
  frame: z.string().startsWith('data:image/jpeg;base64,'),
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
})

// A frame sampled from the live Ring stream in the staff browser. Classified with Bedrock, then reconciled.
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Expected a JPEG data URL and a deviceId' }, { status: 400 })
  const { frame, deviceId, deviceName } = parsed.data
  const jpeg = Buffer.from(frame.slice(frame.indexOf(',') + 1), 'base64')
  if (jpeg.byteLength > MAX_FRAME_BYTES) return NextResponse.json({ error: 'Frame too large' }, { status: 413 })

  const vision = await classifyFrame(new Uint8Array(jpeg))
  const result = recordObservation({ deviceId, deviceName, source: 'ring_live', frame }, vision)
  return NextResponse.json({ vision, ...result })
}
