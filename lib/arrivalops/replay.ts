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

export const DEFAULT_STEPS: ReplayStep[] = [
  {
    delayMs: 0,
    frame: '/replay/driveway-car-passing.jpg',
    note: 'Car driving past',
    recorded: false,
    vision: { vehiclePresent: true, stopped: false, colour: 'grey', vehicleType: 'hatchback', confidence: 0.85 },
  },
  {
    delayMs: 4000,
    frame: '/replay/lot-bays-clear.jpg',
    note: 'Pickup bays clear',
    recorded: false,
    vision: { vehiclePresent: false, stopped: 'unclear', confidence: 0.9 },
  },
  { delayMs: 4000, frame: '/replay/lot-car-in-bay.jpg', note: 'Car stops in a bay', recorded: false, vision: CAR_IN_BAY },
  { delayMs: 8000, frame: '/replay/lot-car-in-bay.jpg', note: 'Still waiting', recorded: false, vision: CAR_IN_BAY },
]
