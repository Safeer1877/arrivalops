// Replay mode: a short scene built from real frames of the Ring Developer Playground "Vehicle" stream,
// captured through this app's WHEP path (see public/replay/manifest.json for when and how). The Playground
// clip never shows a car pulling in and waiting, so the order and timing of these frames are staged; the
// desk says so. It lets judges and visitors try ArrivalOps without a Ring token.

import type { VisionResult } from './types'

export interface ReplayStep {
  delayMs: number // after the previous step
  frame: string // path under /public
  vision: Omit<VisionResult, 'latencyMs' | 'model'> & { latencyMs?: number; model?: string }
  // true once the answer was captured from a real Bedrock call on this exact frame; until then it is the
  // answer we expect, and the desk labels it as scripted
  recorded: boolean
  note: string
}

export const REPLAY_DEVICE = { deviceId: 'replay.playground.vehicle', deviceName: 'Pickup bays (Ring Playground replay)' }

const CAR_IN_BAY = { vehiclePresent: true, stopped: true, colour: 'grey', vehicleType: 'hatchback', confidence: 0.9 } as const
const CLEAR = { vehiclePresent: false, stopped: 'unclear', confidence: 0.9 } as const

const step = (delayMs: number, frame: 'clear' | 'car', note: string): ReplayStep => ({
  delayMs,
  frame: frame === 'car' ? '/replay/lot-car-in-bay.jpg' : '/replay/lot-bays-clear.jpg',
  note,
  recorded: false,
  vision: frame === 'car' ? CAR_IN_BAY : CLEAR,
})

// About 80 seconds: the car stops, staff are alerted after the demo dwell time, the tablet calls it out if
// nobody acts, and if the visitor still does nothing the customer gives up and drives off.
export const DEFAULT_STEPS: ReplayStep[] = [
  step(0, 'clear', 'Pickup bays clear'),
  step(4000, 'car', 'Car stops in the pickup bay'),
  step(7000, 'car', 'Still there, staff alerted'),
  step(10_000, 'car', 'Still waiting'),
  step(10_000, 'car', 'Still waiting'),
  step(10_000, 'car', 'Still waiting'),
  step(10_000, 'car', 'Still waiting'),
  step(10_000, 'car', 'Still waiting'),
  step(10_000, 'clear', 'Car drove off'),
]
