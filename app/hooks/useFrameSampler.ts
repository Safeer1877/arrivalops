'use client'

import { RefObject, useEffect, useRef, useState } from 'react'
import type { VisionResult } from '@/lib/arrivalops/types'

interface Options {
  videoRef: RefObject<HTMLVideoElement>
  enabled: boolean
  deviceId?: string
  deviceName?: string
  intervalMs?: number
  onResult?: () => void
}

const SMALL_W = 32
const SMALL_H = 18
const CHANGE_THRESHOLD = 12 // mean absolute luminance change (0-255) that counts as "something moved"
const HEARTBEAT_MS = 20_000 // re-check an unchanged scene this often, so a parked car is still confirmed

/**
 * Samples the live Ring stream and sends a frame to the server only when the scene changed (or as a slow
 * heartbeat). Ring's CV guidelines recommend filtering early so the expensive model only sees useful frames.
 */
export function useFrameSampler({ videoRef, enabled, deviceId, deviceName, intervalMs = 3000, onResult }: Options) {
  const [last, setLast] = useState<{ vision: VisionResult; at: number } | null>(null)
  const [stats, setStats] = useState({ sampled: 0, sent: 0 })
  const prev = useRef<Uint8ClampedArray | null>(null)
  const lastSent = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!enabled || !deviceId) return
    const big = document.createElement('canvas')
    const small = document.createElement('canvas')
    small.width = SMALL_W
    small.height = SMALL_H

    const t = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || inFlight.current) return
      const sctx = small.getContext('2d', { willReadFrequently: true })!
      sctx.drawImage(video, 0, 0, SMALL_W, SMALL_H)
      const px = sctx.getImageData(0, 0, SMALL_W, SMALL_H).data
      let diff = 255
      if (prev.current) {
        let sum = 0
        for (let i = 0; i < px.length; i += 4) {
          const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
          const p = 0.299 * prev.current[i] + 0.587 * prev.current[i + 1] + 0.114 * prev.current[i + 2]
          sum += Math.abs(y - p)
        }
        diff = sum / (SMALL_W * SMALL_H)
      }
      setStats((s) => ({ ...s, sampled: s.sampled + 1 }))
      const now = Date.now()
      if (diff < CHANGE_THRESHOLD && now - lastSent.current < HEARTBEAT_MS) return
      prev.current = px

      big.width = 640
      big.height = Math.round((640 * video.videoHeight) / Math.max(1, video.videoWidth)) || 360
      big.getContext('2d')!.drawImage(video, 0, 0, big.width, big.height)
      const frame = big.toDataURL('image/jpeg', 0.72)
      inFlight.current = true
      lastSent.current = now
      try {
        const res = await fetch('/api/arrivalops/observe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame, deviceId, deviceName }),
        })
        if (res.ok) {
          const data = await res.json()
          setLast({ vision: data.vision, at: Date.now() })
          setStats((s) => ({ ...s, sent: s.sent + 1 }))
          onResult?.()
        }
      } finally {
        inFlight.current = false
      }
    }, intervalMs)
    return () => clearInterval(t)
  }, [enabled, deviceId, deviceName, intervalMs, videoRef, onResult])

  return { last, stats }
}
