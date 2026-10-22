import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_STEPS, REPLAY_DEVICE } from '@/lib/arrivalops/replay'
import { boardFor, rememberBoard } from '@/lib/arrivalops/board'
import { ctxNow, recordObservation } from '@/lib/arrivalops/store'
import { MODEL_ID } from '@/lib/arrivalops/vision'

export const dynamic = 'force-dynamic'

// Plays one step of the recorded Playground session. The browser drives the timing so this also works
// on hosts that don't keep background timers alive.
export async function POST(request: NextRequest) {
  const { step } = await request.json().catch(() => ({ step: -1 }))
  const s = DEFAULT_STEPS[step]
  if (!Number.isInteger(step) || !s) return NextResponse.json({ error: 'Unknown replay step' }, { status: 400 })
  const vision = { latencyMs: 0, model: s.recorded ? `${MODEL_ID} (recorded)` : 'scripted answer', ...s.vision }
  const board = boardFor(request)
  const result = recordObservation({ ...REPLAY_DEVICE, source: 'replay', frame: s.frame }, vision, ctxNow(), board.boardId)
  const next = DEFAULT_STEPS[step + 1]
  const res = NextResponse.json({
    ...result,
    note: s.note,
    step,
    total: DEFAULT_STEPS.length,
    nextStep: next ? step + 1 : null,
    nextDelayMs: next?.delayMs ?? null,
  })
  return rememberBoard(res, board)
}
