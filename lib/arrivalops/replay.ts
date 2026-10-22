// Replay mode: a short scene built from real frames of the Ring Developer Playground "Vehicle" stream,
// captured through this app's WHEP path (see public/replay/manifest.json for when and how). The Playground
// clip never shows a car pulling in and waiting, so the order and timing of these frames are staged; the
// desk says so. It lets judges and visitors try ArrivalOps without a Ring token.

import type { VisionResult, Zone } from './types'

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

// Where the grey hatchback sits in lot-car-in-bay.jpg, as fractions of the frame. Used to answer for the bay
// the visitor marked: a bay drawn somewhere else on the picture really does see an empty bay.
export const CAR_BOX: Zone = { x: 0.75, y: 0.54, w: 0.22, h: 0.25 }

const CAR_IN_BAY = { vehiclePresent: true, stopped: true, colour: 'grey', vehicleType: 'hatchback', confidence: 0.9 } as const
const CLEAR = { vehiclePresent: false, stopped: 'unclear', confidence: 0.9 } as const

const step = (delayMs: number, frame: 'clear' | 'car', note: string): ReplayStep => ({
  delayMs,
  frame: frame === 'car' ? '/replay/lot-car-in-bay.jpg' : '/replay/lot-bays-clear.jpg',
  note,
  recorded: false,
  vision: frame === 'car' ? CAR_IN_BAY : CLEAR,
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

/** The step's answer as seen through the marked bay: a car whose centre is outside the bay isn't in it. */
export function answerFor(s: ReplayStep, zone: Zone | null): ReplayStep['vision'] {
  if (!zone || s.vision.vehiclePresent !== true) return s.vision
  const cx = CAR_BOX.x + CAR_BOX.w / 2
  const cy = CAR_BOX.y + CAR_BOX.h / 2
  const inside = cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h
  return inside ? s.vision : CLEAR
}
