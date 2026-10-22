// The free, on-device vehicle check: COCO-SSD (SSDLite MobileNet v2, Apache-2.0) finds vehicles in the frame,
// and these pure functions turn its boxes into the same narrow answer Bedrock gives: is a vehicle waiting in the
// bay? Shared by the browser (live Ring video) and the script that recorded the replay answers, so both paths
// reach the same verdict from the same boxes.

import type { VisionResult, Zone } from './types'

export const DETECTOR_MODEL = 'COCO-SSD on-device'
export const DETECTOR_MODEL_URL = '/models/ssdlite_mobilenet_v2/model.json'

/** One vehicle the detector found, with its box as fractions of the frame. */
export interface Detection {
  label: string
  score: number
  box: Zone
  colour?: string
}

/** COCO-SSD's raw output: class name, score, and a pixel box [x, y, width, height]. */
export interface RawDetection {
  class: string
  score: number
  bbox: [number, number, number, number]
}

const VEHICLES = new Set(['car', 'truck', 'bus', 'motorcycle'])
const MIN_SCORE = 0.35 // below this a box is noise
const SURE_SCORE = 0.5 // below this a vehicle is reported as "unclear", never as a fact
const MOVE_TOLERANCE = 0.04 // centre shift, as a fraction of the frame, that still counts as standing still

export function vehiclesOnly(raw: RawDetection[], width: number, height: number): Detection[] {
  return raw
    .filter((d) => VEHICLES.has(d.class) && d.score >= MIN_SCORE)
    .map((d) => ({
      label: d.class,
      score: d.score,
      box: { x: d.bbox[0] / width, y: d.bbox[1] / height, w: d.bbox[2] / width, h: d.bbox[3] / height },
    }))
}

/** A vehicle belongs to the bay when its centre is inside it, so a car half in a neighbouring space doesn't count. */
export function inBay(d: Detection, zone: Zone | null): boolean {
  if (!zone) return true
  const cx = d.box.x + d.box.w / 2
  const cy = d.box.y + d.box.h / 2
  return cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h
}

export function moved(a: Zone, b: Zone): boolean {
  const dx = a.x + a.w / 2 - (b.x + b.w / 2)
  const dy = a.y + a.h / 2 - (b.y + b.h / 2)
  return Math.hypot(dx, dy) > MOVE_TOLERANCE
}

/**
 * The bay's answer. The largest vehicle in the bay is the one that matters. It counts as stopped when some vehicle
 * was in that spot at the last look (the detector may pick a neighbouring parked car as the largest from one look to
 * the next, which is not movement). A first sighting counts as stopped; the dwell time before any alert filters out
 * cars that were only passing.
 */
export function judgeBay(detections: Detection[], zone: Zone | null, previous: Zone[] | null, latencyMs: number): VisionResult {
  const inside = detections.filter((d) => inBay(d, zone)).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
  const top = inside[0]
  if (!top) return { vehiclePresent: false, stopped: 'unclear', confidence: 0.9, model: DETECTOR_MODEL, latencyMs }
  return {
    vehiclePresent: top.score >= SURE_SCORE ? true : 'unclear',
    stopped: previous?.length ? previous.some((p) => !moved(p, top.box)) : true,
    colour: top.colour,
    vehicleType: top.label,
    confidence: Math.round(top.score * 100) / 100,
    model: DETECTOR_MODEL,
    latencyMs,
    box: top.box,
  }
}

/**
 * A coarse body colour from the doors: the middle of the box, below the windows (the edges are road, the top is
 * glass). Mostly grey-scale pixels give black, grey or white by their median brightness; otherwise the most common
 * hue wins. RGBA pixels, as both canvas and jpeg-js give them.
 */
export function bodyColour(rgba: ArrayLike<number>, width: number, height: number, box: Zone): string | undefined {
  const x0 = Math.floor((box.x + box.w * 0.25) * width)
  const x1 = Math.ceil((box.x + box.w * 0.75) * width)
  const y0 = Math.floor((box.y + box.h * 0.5) * height)
  const y1 = Math.ceil((box.y + box.h * 0.8) * height)
  const hues: Record<string, number> = {}
  const greys: number[] = []
  let n = 0
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y += 2) {
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 2) {
      const i = (y * width + x) * 4
      const r = rgba[i] / 255
      const g = rgba[i + 1] / 255
      const b = rgba[i + 2] / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      n++
      if (sat < 0.3 || max < 0.2) {
        greys.push(max)
        continue
      }
      const h = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
      const name = h < 0.5 || h >= 5.5 ? 'red' : h < 1 ? 'orange' : h < 1.5 ? 'yellow' : h < 3 ? 'green' : h < 4.5 ? 'blue' : 'purple'
      hues[name] = (hues[name] ?? 0) + 1
    }
  }
  if (!n) return undefined
  if (greys.length / n >= 0.6) {
    const v = greys.sort((a, b) => a - b)[greys.length >> 1]
    return v < 0.15 ? 'black' : v < 0.75 ? 'grey' : 'white'
  }
  return Object.entries(hues).sort((a, b) => b[1] - a[1])[0]?.[0]
}
