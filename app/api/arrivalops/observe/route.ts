import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import '@/lib/arrivalops/diskPersistence'
import { recordObservation } from '@/lib/arrivalops/store'
import { classifyLive } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

const MAX_FRAME_BYTES = 1_500_000

const Body = z.object({
  frame: z.string().startsWith('data:image/jpeg;base64,'),
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  // What the on-device detector in the browser found in this frame.
  vision: z
    .object({
      vehiclePresent: z.union([z.boolean(), z.literal('unclear')]),
      stopped: z.union([z.boolean(), z.literal('unclear')]),
      colour: z.string().max(20).optional(),
      vehicleType: z.string().max(20).optional(),
      confidence: z.number().min(0).max(1),
      model: z.string().max(60),
      latencyMs: z.number().min(0),
      box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
    })
    .optional(),
})

// A frame sampled from the live Ring stream in the staff browser, with the on-device detector's answer.
// Bedrock gives a second opinion when the AWS account allows it; then the frame is reconciled.
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Expected a JPEG data URL and a deviceId' }, { status: 400 })
  const { frame, deviceId, deviceName, vision: onDevice } = parsed.data
  const jpeg = Buffer.from(frame.slice(frame.indexOf(',') + 1), 'base64')
  if (jpeg.byteLength > MAX_FRAME_BYTES) return NextResponse.json({ error: 'Frame too large' }, { status: 413 })

  const vision = await classifyLive(new Uint8Array(jpeg), onDevice)
  const result = recordObservation({ deviceId, deviceName, source: 'ring_live', frame }, vision)
  return NextResponse.json({ vision, ...result })
}
