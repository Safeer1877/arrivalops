'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import { bodyColour, inBay, judgeBay, vehiclesOnly, type RawDetection } from '@/lib/arrivalops/detector'
import { loadDetector } from '@/lib/arrivalops/detectorClient'
import type { VisionResult, Zone } from '@/lib/arrivalops/types'

interface Options {
  videoRef: RefObject<HTMLVideoElement>
  enabled: boolean
  deviceId?: string
  deviceName?: string
  zone?: Zone | null
  /** The part of the raw video that is on screen. The bay is drawn on screen, so it is measured inside this. */
  crop?: Zone
  intervalMs?: number
  onResult?: () => void
}

const VIEW_W = 640
const VIEW_H = 360
const HEARTBEAT_MS = 20_000 // report an unchanged answer this often, so a parked car is still confirmed
const STALL_TICKS = 2 // samples in a row with the video clock standing still before the feed counts as stalled
const FULL: Zone = { x: 0, y: 0, w: 1, h: 1 }

export type DetectorState = 'loading' | 'ready' | 'failed'

/**
 * Looks at the live Ring stream every few seconds with the on-device detector, and reports to the desk only when
 * the answer changes (or as a slow heartbeat). Each report carries the marked bay cropped out of the frame, for
 * the alert card and for Bedrock when the account allows it; the rest of the street never leaves the browser.
 */
export function useFrameSampler({ videoRef, enabled, deviceId, deviceName, zone, crop = FULL, intervalMs = 3000, onResult }: Options) {
  const [last, setLast] = useState<{ vision: VisionResult; at: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [stalled, setStalled] = useState(false)
  const [region, setRegion] = useState<{ w: number; h: number } | null>(null)
  const [detector, setDetector] = useState<DetectorState>('loading')
  const inFlight = useRef(false)
  // The board polls every 2 s and hands back a fresh zone object and callback each time. Depending on those directly
  // restarted the sampling interval before it ever fired, so the effect keys on the zone's numbers instead.
  const zoneRef = useRef(zone)
  zoneRef.current = zone
  const cropRef = useRef(crop)
  cropRef.current = crop
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const zoneKey = zone ? [zone.x, zone.y, zone.w, zone.h].join(',') : 'all'

  useEffect(() => {
    if (!enabled) return
    loadDetector().then(
      () => setDetector('ready'),
      () => setDetector('failed'),
    )
  }, [enabled])

  useEffect(() => {
    setStalled(false)
    if (!enabled || !deviceId) return
    let lastTime = -1
    let still = 0
    let previousBoxes: Zone[] | null = null
    let reported: VisionResult | null = null
    let reportedAt = 0
    const view = document.createElement('canvas')
    view.width = VIEW_W
    view.height = VIEW_H
    const bay = document.createElement('canvas')

    const t = setInterval(async () => {
      const video = videoRef.current
      if (!video) return
      // A WebRTC stream can stop delivering frames without any error event; the video clock standing still is the tell.
      still = video.currentTime === lastTime ? still + 1 : 0
      lastTime = video.currentTime
      setStalled(still >= STALL_TICKS)
      if (still || video.readyState < 2 || inFlight.current) return
      inFlight.current = true
      try {
        const z = zoneRef.current ?? FULL
        const c = cropRef.current
        const vw = video.videoWidth
        const vh = video.videoHeight
        const vctx = view.getContext('2d', { willReadFrequently: true })!
        vctx.drawImage(video, c.x * vw, c.y * vh, c.w * vw, c.h * vh, 0, 0, VIEW_W, VIEW_H)

        // The on-device answer. If the detector can't load, the frame still goes to the server for Bedrock.
        let vision: VisionResult | undefined
        const model = await loadDetector().catch(() => null)
        if (model) {
          const started = performance.now()
          const raw = (await model.detect(view, 20, 0.3)) as RawDetection[]
          const pixels = vctx.getImageData(0, 0, VIEW_W, VIEW_H).data
          const vehicles = vehiclesOnly(raw, VIEW_W, VIEW_H).map((d) => ({ ...d, colour: bodyColour(pixels, VIEW_W, VIEW_H, d.box) }))
          vision = judgeBay(vehicles, zoneRef.current ?? null, previousBoxes, Math.round(performance.now() - started))
          previousBoxes = vehicles.filter((d) => inBay(d, zoneRef.current ?? null)).map((d) => d.box)
          const now = Date.now()
          const same =
            reported &&
            reported.vehiclePresent === vision.vehiclePresent &&
            reported.stopped === vision.stopped &&
            reported.vehicleType === vision.vehicleType
          // A moving car is looked at again on the next tick, so the moment it parks is caught.
          if (same && reported?.stopped !== false && now - reportedAt < HEARTBEAT_MS) {
            setLast({ vision, at: now })
            return
          }
        }

        const sx = (c.x + z.x * c.w) * vw
        const sy = (c.y + z.y * c.h) * vh
        const sw = Math.max(1, z.w * c.w * vw)
        const sh = Math.max(1, z.h * c.h * vh)
        bay.width = Math.min(640, Math.round(sw))
        bay.height = Math.round((bay.width * sh) / sw)
        bay.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, bay.width, bay.height)
        setRegion({ w: bay.width, h: bay.height })
        setChecking(true)
        const res = await fetch('/api/arrivalops/observe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: bay.toDataURL('image/jpeg', 0.72), deviceId, deviceName, vision }),
        })
        if (res.ok) {
          const data = await res.json()
          reported = vision ?? data.vision
          reportedAt = Date.now()
          setLast({ vision: data.vision, at: reportedAt })
          onResultRef.current?.()
        }
      } catch {
        // A dropped look is retried on the next tick.
      } finally {
        inFlight.current = false
        setChecking(false)
      }
    }, intervalMs)
    return () => clearInterval(t)
    // zoneKey stands in for zone, read through zoneRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, deviceId, deviceName, zoneKey, intervalMs, videoRef])

  return { last, checking, stalled, region, detector }
}
