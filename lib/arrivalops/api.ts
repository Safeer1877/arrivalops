// The desk's API as plain functions over a board, so the Next.js routes and the in-browser demo answer every
// request the same way. Each returns a status and a JSON body.

import { DETECTOR_MODEL } from './detector'
import { ActionError, settingsOf } from './reconcile'
import { answerFor, DEFAULT_STEPS, DRIVE_OFF, REPLAY_DEVICE } from './replay'
import { ctxNow, dispatch, getState, recordObservation, restartReplay, takeAnnouncements, view } from './store'

export interface ApiResult {
  status: number
  body: unknown
}

export type Mode = {
  live: boolean
  detectorModel: string
  bedrockModel: string
  bedrock: { state: 'off' } | { state: 'active' } | { state: 'unavailable'; error: string }
}

export function getBoard(boardId: string, mode: Omit<Mode, 'detectorModel'>): ApiResult {
  return { status: 200, body: { ...view(getState(boardId)), mode: { ...mode, detectorModel: DETECTOR_MODEL } } }
}

export function postAction(boardId: string, input: unknown): ApiResult {
  try {
    return { status: 200, body: dispatch(input, ctxNow(), boardId) }
  } catch (err) {
    if (err instanceof ActionError) return { status: err.status, body: { error: err.message } }
    console.error('ArrivalOps action failed:', err)
    return { status: 500, body: { error: 'Something went wrong; nothing was changed.' } }
  }
}

// With call-outs on, returns cases nobody has acted on within the call-out delay, once each, so the counter
// tablet can say them out loud. Without, nothing is marked announced.
export function postTick(boardId: string, speaking: boolean): ApiResult {
  return { status: 200, body: { announce: takeAnnouncements(ctxNow(), boardId, speaking).map((c) => ({ caseId: c.id })) } }
}

// Plays one step of the recorded Playground session. The browser drives the timing, so this also works on
// hosts that don't keep background timers alive. 'leave' is the demo control that makes the waiting driver
// give up; numbers are steps of the recording.
export function postReplay(boardId: string, step: unknown): ApiResult {
  const s = step === 'leave' ? DRIVE_OFF : Number.isInteger(step) ? DEFAULT_STEPS[step as number] : undefined
  if (!s) return { status: 400, body: { error: 'Unknown replay step' } }
  const n = step === 'leave' ? -1 : (step as number)
  if (n === 0) restartReplay(ctxNow(), boardId)
  const vision = answerFor(s, settingsOf(getState(boardId)).zone)
  const carFrame = s !== DRIVE_OFF && n !== 0
  const result = recordObservation({ ...REPLAY_DEVICE, source: 'replay', frame: s.frame }, vision, ctxNow(), boardId)
  const next = step === 'leave' ? undefined : DEFAULT_STEPS[n + 1]
  return {
    status: 200,
    body: {
      ...result,
      // The detector's real answer can differ from the script when the visitor moved the bay; say why.
      note:
        carFrame && vision.vehiclePresent === false
          ? 'The car is outside the marked bay, so it is ignored'
          : !carFrame && vision.vehiclePresent !== false
            ? 'Parked cars are inside the marked bay. Mark just the pickup bay'
            : s.note,
      step: step === 'leave' ? DEFAULT_STEPS.length - 1 : n,
      total: DEFAULT_STEPS.length,
      nextStep: next ? n + 1 : null,
      nextDelayMs: next?.delayMs ?? null,
    },
  }
}
