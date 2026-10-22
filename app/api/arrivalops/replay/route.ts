import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_STEPS, REPLAY_DEVICE } from '@/lib/arrivalops/replay'
import { recordObservation } from '@/lib/arrivalops/store'
import { MODEL_ID } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

// Plays one step of the recorded Playground session. The browser drives the timing so this also works
// on hosts that don't keep background timers alive.
export async function POST(request: NextRequest) {
  const { step } = await request.json().catch(() => ({ step: -1 }))
  const s = DEFAULT_STEPS[step]
  if (!Number.isInteger(step) || !s) return NextResponse.json({ error: 'Unknown replay step' }, { status: 400 })
  const vision = { latencyMs: 0, model: `${MODEL_ID} (recorded)`, ...s.vision }
  const result = recordObservation({ ...REPLAY_DEVICE, source: 'replay', frame: s.frame }, vision)
  const next = DEFAULT_STEPS[step + 1]
  return NextResponse.json({ ...result, note: s.note, nextStep: next ? step + 1 : null, nextDelayMs: next?.delayMs ?? null })
}
