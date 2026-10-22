import { NextRequest, NextResponse } from 'next/server'
import { answerFor, DEFAULT_STEPS, DRIVE_OFF, REPLAY_DEVICE } from '@/lib/arrivalops/replay'
import { boardFor, rememberBoard } from '@/lib/arrivalops/board'
import { settingsOf } from '@/lib/arrivalops/reconcile'
import { ctxNow, getState, recordObservation, restartReplay } from '@/lib/arrivalops/store'

export const dynamic = 'force-dynamic'

// Plays one step of the recorded Playground session. The browser drives the timing so this also works
// on hosts that don't keep background timers alive.
export async function POST(request: NextRequest) {
  const { step } = await request.json().catch(() => ({ step: -1 }))
  // 'leave' is the demo control that makes the waiting driver give up; numbers are steps of the recording.
  const s = step === 'leave' ? DRIVE_OFF : Number.isInteger(step) ? DEFAULT_STEPS[step] : undefined
  if (!s) return NextResponse.json({ error: 'Unknown replay step' }, { status: 400 })
  const board = boardFor(request)
  if (step === 0) restartReplay(ctxNow(), board.boardId)
  const vision = answerFor(s, settingsOf(getState(board.boardId)).zone)
  const carFrame = s !== DRIVE_OFF && step !== 0
  const result = recordObservation({ ...REPLAY_DEVICE, source: 'replay', frame: s.frame }, vision, ctxNow(), board.boardId)
  const next = step === 'leave' ? undefined : DEFAULT_STEPS[step + 1]
  const res = NextResponse.json({
    ...result,
    // The detector's real answer can differ from the script when the visitor moved the bay; say why.
    note:
      carFrame && vision.vehiclePresent === false
        ? 'The car is outside the marked bay, so it is ignored'
        : !carFrame && vision.vehiclePresent !== false
          ? 'Parked cars are inside the marked bay. Mark just the pickup bay'
          : s.note,
    step: step === 'leave' ? DEFAULT_STEPS.length - 1 : step,
    total: DEFAULT_STEPS.length,
    nextStep: next ? step + 1 : null,
    nextDelayMs: next?.delayMs ?? null,
  })
  return rememberBoard(res, board)
}
