// Replay mode: a recorded run of the Ring Developer Playground "Vehicle" stream, with the Bedrock answers
// captured at recording time. It lets judges and visitors try ArrivalOps without a Ring token, and is
// always labelled "Replay" in the UI. Frames live in public/replay/ (see scripts/record-replay.md).

import type { VisionResult } from './types'

export interface ReplayStep {
  delayMs: number // after the previous step
  frame: string // path under /public
  vision: Omit<VisionResult, 'latencyMs' | 'model'> & { latencyMs?: number; model?: string }
  note: string
}

// Recorded from the Playground Vehicle simulation; see replay/manifest.json when present.
export const REPLAY_DEVICE = { deviceId: 'replay.playground.vehicle', deviceName: 'Pickup bay (Ring Playground replay)' }

export const DEFAULT_STEPS: ReplayStep[] = [
  { delayMs: 0, frame: '/replay/01.jpg', note: 'Bay clear', vision: { vehiclePresent: false, stopped: 'unclear', confidence: 0.9 } },
  {
    delayMs: 4000,
    frame: '/replay/02.jpg',
    note: 'Car pulling in',
    vision: { vehiclePresent: true, stopped: false, colour: 'silver', vehicleType: 'hatchback', confidence: 0.82 },
  },
  {
    delayMs: 4000,
    frame: '/replay/03.jpg',
    note: 'Car stops and waits',
    vision: { vehiclePresent: true, stopped: true, colour: 'silver', vehicleType: 'hatchback', confidence: 0.9 },
  },
  {
    delayMs: 8000,
    frame: '/replay/04.jpg',
    note: 'Still waiting',
    vision: { vehiclePresent: true, stopped: true, colour: 'silver', vehicleType: 'hatchback', confidence: 0.91 },
  },
]
