// Replay mode: a short scene built from real frames of the Ring Developer Playground "Vehicle" stream,
// captured through this app's WHEP path (see public/replay/manifest.json for when and how). The Playground
// clip never shows a car pulling in and waiting, so the order and timing of these frames are staged; the
// desk says so. It lets judges and visitors try ArrivalOps without a Ring token.

import { judgeBay, type Detection } from './detector'
import recorded from './replayDetections.json'
import type { VisionResult, Zone } from './types'

export interface ReplayStep {
  delayMs: number // after the previous step
  frame: string // path under /public
  note: string
}

export const REPLAY_DEVICE = { deviceId: 'replay.playground.vehicle', deviceName: 'Pickup bays (Ring Playground replay)' }

// What the on-device detector found on each replay frame, recorded by scripts/record-detections.ts with the same
// model files the live desk loads. Replay answers are judged from these boxes, so they are real model output.
const RECORDED = recorded as unknown as {
  model: string
  frames: Record<string, { latencyMs: number; vehicles: Detection[] }>
}

const CLEAR_FRAME = '/replay/lot-bays-clear.jpg'
const CAR_FRAME = '/replay/lot-car-in-bay.jpg'

const step = (delayMs: number, frame: 'clear' | 'car', note: string): ReplayStep => ({
  delayMs,
  frame: frame === 'car' ? CAR_FRAME : CLEAR_FRAME,
  note,
})

// About 30 seconds: the car stops, staff are alerted after the demo dwell time, and the tablet calls it out
// if nobody acts. The driver then stays put until the visitor matches them, so nobody watches the demo "fail"
// while still reading the card. Leaving is a separate, deliberate demo control (DRIVE_OFF).
export const DEFAULT_STEPS: ReplayStep[] = [
  step(0, 'clear', 'Pickup bay empty'),
  step(4000, 'car', 'A car pulls in. Nobody has checked in'),
  step(7000, 'car', 'Still there, so staff are alerted'),
  step(10_000, 'car', 'Driver still waiting for someone to come out'),
  step(10_000, 'car', 'Driver waiting. Match them to an order'),
]

/** Demo control: the driver gives up and leaves, to show what a missed pickup looks like. */
export const DRIVE_OFF: ReplayStep = step(0, 'clear', 'Nobody came out, so the driver left')

/**
 * The detector's answer for this step, seen through the marked bay. The frames are stills, so a vehicle seen
 * on the step before is in the same place: it counts as stopped, exactly as a parked car on the live feed does.
 */
export function answerFor(s: ReplayStep, zone: Zone | null): VisionResult {
  const f = RECORDED.frames[s.frame]
  const v = judgeBay(f?.vehicles ?? [], zone, null, f?.latencyMs ?? 0)
  return { ...v, model: `${RECORDED.model} (recorded)` }
}
